// ─── Weather Data Source ──────────────────────────────────────────────────────
//
// Uses Open-Meteo API (https://open-meteo.com) — 100% free, no API key.
// Geocoding is done via Open-Meteo's companion geocoding API.
//
// Config:
//   city        — city name (e.g. "Kolkata", "London")
//   days        — forecast days (1–7, default 3)
//   units       — "celsius" | "fahrenheit" (default celsius)

import type { DataSource, DataSourceResult, DataSourceFieldDef, DataSourceItem } from "./types";

interface GeoResult {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
}

const WMO_CODES: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Heavy drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm w/ hail", 99: "Thunderstorm w/ heavy hail",
};

export class WeatherSource implements DataSource {
    readonly id = "weather";
    readonly label = "Weather Report";
    readonly description = "Daily weather forecast for any city (free, no API key)";

    readonly configFields: DataSourceFieldDef[] = [
        {
            key: "city",
            label: "City",
            type: "text",
            placeholder: "e.g. Kolkata, Mumbai, London",
            defaultValue: "Kolkata",
            required: true,
        },
        {
            key: "days",
            label: "Forecast Days",
            type: "number",
            defaultValue: 3,
            placeholder: "1–7",
            required: false,
        },
        {
            key: "units",
            label: "Temperature Unit",
            type: "select",
            defaultValue: "celsius",
            options: [
                { value: "celsius", label: "Celsius (°C)" },
                { value: "fahrenheit", label: "Fahrenheit (°F)" },
            ],
            required: false,
        },
    ];

    async fetch(config: Record<string, unknown>): Promise<DataSourceResult> {
        const city = (config.city as string | undefined) || "Kolkata";
        const days = Math.min(Math.max(Number(config.days) || 3, 1), 7);
        const units = (config.units as string | undefined) === "fahrenheit" ? "fahrenheit" : "celsius";
        const unitSymbol = units === "fahrenheit" ? "°F" : "°C";

        // Step 1: Geocode city name → lat/lng
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(8000) });
        if (!geoRes.ok) throw new Error(`Geocoding failed: ${geoRes.status}`);

        const geoData = await geoRes.json() as { results?: GeoResult[] };
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error(`City not found: "${city}". Try a different spelling.`);
        }

        const location = geoData.results[0];
        const { latitude, longitude, name, country, admin1 } = location;
        const locationLabel = [name, admin1, country].filter(Boolean).join(", ");

        // Step 2: Fetch weather forecast
        const weatherUrl = [
            `https://api.open-meteo.com/v1/forecast`,
            `?latitude=${latitude}&longitude=${longitude}`,
            `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,sunrise,sunset`,
            `&current_weather=true`,
            `&temperature_unit=${units}`,
            `&windspeed_unit=kmh`,
            `&timezone=auto`,
            `&forecast_days=${days}`,
        ].join("");

        const wxRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(8000) });
        if (!wxRes.ok) throw new Error(`Weather API error: ${wxRes.status}`);

        const wx = await wxRes.json() as {
            current_weather: {
                temperature: number;
                windspeed: number;
                weathercode: number;
            };
            daily: {
                time: string[];
                weathercode: number[];
                temperature_2m_max: number[];
                temperature_2m_min: number[];
                precipitation_sum: number[];
                windspeed_10m_max: number[];
                sunrise: string[];
                sunset: string[];
            };
        };

        const current = wx.current_weather;
        const daily = wx.daily;

        const items: DataSourceItem[] = daily.time.map((date, i) => {
            const condition = WMO_CODES[daily.weathercode[i]] || `Code ${daily.weathercode[i]}`;
            const max = Math.round(daily.temperature_2m_max[i]);
            const min = Math.round(daily.temperature_2m_min[i]);
            const rain = daily.precipitation_sum[i].toFixed(1);
            const wind = Math.round(daily.windspeed_10m_max[i]);
            const sunrise = daily.sunrise[i]?.split("T")[1] || "";
            const sunset = daily.sunset[i]?.split("T")[1] || "";

            const dateLabel = new Date(date).toLocaleDateString("en-IN", {
                weekday: "short", month: "short", day: "numeric",
            });

            return {
                title: `${dateLabel} — ${condition}`,
                url: `https://open-meteo.com/en/docs`,
                description: `🌡️ ${max}${unitSymbol} / ${min}${unitSymbol} · 🌧️ ${rain}mm · 💨 ${wind} km/h · 🌅 ${sunrise} 🌇 ${sunset}`,
                location: locationLabel,
                weather: condition,
                tempMax: `${max}${unitSymbol}`,
                tempMin: `${min}${unitSymbol}`,
                precipitation: `${rain}mm`,
                wind: `${wind} km/h`,
            };
        });

        const currentCondition = WMO_CODES[current.weathercode] || "Unknown";

        return {
            source: this.label,
            fetchedAt: new Date().toISOString(),
            items,
            meta: {
                city: locationLabel,
                currentTemp: `${Math.round(current.temperature)}${unitSymbol}`,
                currentCondition,
                currentWind: `${Math.round(current.windspeed)} km/h`,
                latitude,
                longitude,
                forecastDays: days,
            },
        };
    }
}
