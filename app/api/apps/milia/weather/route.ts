import { NextRequest, NextResponse } from "next/server";

type GeoResult = {
  latitude: number;
  longitude: number;
  timezone?: string;
  name?: string;
  admin1?: string;
  country?: string;
};

function weatherCodeLabel(code: number | null | undefined) {
  const map: Record<number, string> = {
    0: "Clear",
    1: "Mostly Clear",
    2: "Partly Cloudy",
    3: "Cloudy",
    45: "Fog",
    48: "Rime Fog",
    51: "Light Drizzle",
    53: "Drizzle",
    55: "Heavy Drizzle",
    56: "Freezing Drizzle",
    57: "Heavy Freezing Drizzle",
    61: "Light Rain",
    63: "Rain",
    65: "Heavy Rain",
    66: "Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Light Snow",
    73: "Snow",
    75: "Heavy Snow",
    77: "Snow Grains",
    80: "Light Showers",
    81: "Showers",
    82: "Heavy Showers",
    85: "Light Snow Showers",
    86: "Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm + Hail",
    99: "Severe Storm + Hail",
  };

  return map[code ?? -1] || "Forecast";
}

async function geocodeLocation(search: string): Promise<GeoResult | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", search);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const first = data?.results?.[0];
  if (!first?.latitude || !first?.longitude) return null;

  return {
    latitude: Number(first.latitude),
    longitude: Number(first.longitude),
    timezone: first.timezone || undefined,
    name: first.name || undefined,
    admin1: first.admin1 || undefined,
    country: first.country || undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const latitude = request.nextUrl.searchParams.get("lat");
    const longitude = request.nextUrl.searchParams.get("lng");
    const search = request.nextUrl.searchParams.get("search");
    const timezone = request.nextUrl.searchParams.get("timezone") || "auto";

    let lat = latitude ? Number(latitude) : null;
    let lng = longitude ? Number(longitude) : null;
    let tz = timezone;

    if (
      (lat === null || Number.isNaN(lat) || lng === null || Number.isNaN(lng)) &&
      search
    ) {
      const geo = await geocodeLocation(search);
      if (!geo) {
        return NextResponse.json(
          { ok: false, error: "Could not resolve location." },
          { status: 404 }
        );
      }
      lat = geo.latitude;
      lng = geo.longitude;
      tz = geo.timezone || timezone || "auto";
    }

    if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json(
        { ok: false, error: "Missing valid location." },
        { status: 400 }
      );
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("timezone", tz);
    url.searchParams.set(
      "current",
      [
        "temperature_2m",
        "apparent_temperature",
        "weather_code",
        "wind_speed_10m",
        "relative_humidity_2m",
        "is_day",
      ].join(",")
    );
    url.searchParams.set(
      "hourly",
      [
        "temperature_2m",
        "weather_code",
        "precipitation_probability",
      ].join(",")
    );
    url.searchParams.set(
      "daily",
      [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "sunrise",
        "sunset",
      ].join(",")
    );
    url.searchParams.set("forecast_days", "7");

    const res = await fetch(url.toString(), {
      next: { revalidate: 60 * 15 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Weather lookup failed." },
        { status: 500 }
      );
    }

    const data = await res.json();

    const current = data?.current || {};
    const daily = data?.daily || {};
    const hourly = data?.hourly || {};

    const todayHigh = daily?.temperature_2m_max?.[0] ?? null;
    const todayLow = daily?.temperature_2m_min?.[0] ?? null;
    const todayCode = daily?.weather_code?.[0] ?? current?.weather_code ?? null;

    const nextHours = Array.isArray(hourly?.time)
      ? hourly.time.slice(0, 12).map((time: string, index: number) => ({
          time,
          temperature: hourly?.temperature_2m?.[index] ?? null,
          weatherCode: hourly?.weather_code?.[index] ?? null,
          precipitationProbability:
            hourly?.precipitation_probability?.[index] ?? null,
          label: weatherCodeLabel(hourly?.weather_code?.[index]),
        }))
      : [];

    const nextDays = Array.isArray(daily?.time)
      ? daily.time.slice(0, 7).map((time: string, index: number) => ({
          time,
          weatherCode: daily?.weather_code?.[index] ?? null,
          label: weatherCodeLabel(daily?.weather_code?.[index]),
          tempMax: daily?.temperature_2m_max?.[index] ?? null,
          tempMin: daily?.temperature_2m_min?.[index] ?? null,
        }))
      : [];

    return NextResponse.json({
      ok: true,
      weather: {
        latitude: lat,
        longitude: lng,
        timezone: data?.timezone || tz,
        current: {
          temperature: current?.temperature_2m ?? null,
          apparentTemperature: current?.apparent_temperature ?? null,
          humidity: current?.relative_humidity_2m ?? null,
          windSpeed: current?.wind_speed_10m ?? null,
          weatherCode: current?.weather_code ?? null,
          label: weatherCodeLabel(current?.weather_code),
          isDay: current?.is_day ?? null,
        },
        today: {
          tempMax: todayHigh,
          tempMin: todayLow,
          weatherCode: todayCode,
          label: weatherCodeLabel(todayCode),
          sunrise: daily?.sunrise?.[0] ?? null,
          sunset: daily?.sunset?.[0] ?? null,
        },
        hourly: nextHours,
        daily: nextDays,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error." },
      { status: 500 }
    );
  }
}
