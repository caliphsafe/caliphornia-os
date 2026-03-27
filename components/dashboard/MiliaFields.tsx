"use client";

type Props = {
  form: {
    weather_location_name: string;
    weather_city: string;
    weather_region: string;
    weather_country: string;
    weather_lat: string;
    weather_lng: string;
    weather_timezone: string;
    weather_search_label: string;
    weather_sort_order: string;
    location_note: string;
  };
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
};

export default function MiliaFields({ form, onChange }: Props) {
  return (
    <section
      style={{
        display: "grid",
        gap: 14,
        padding: 18,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 20,
            letterSpacing: "-0.03em",
          }}
        >
          Milia Location Fields
        </h3>
        <p
          style={{
            margin: "8px 0 0",
            color: "rgba(255,255,255,0.68)",
            lineHeight: 1.5,
          }}
        >
          These fields connect the song to a real place and power the weather
          experience.
        </p>
      </div>

      <div style={grid2}>
        <label style={labelStyle}>
          <span>Place Name</span>
          <input
            name="weather_location_name"
            value={form.weather_location_name}
            onChange={onChange}
            placeholder="Dakar"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>Weather Search Label</span>
          <input
            name="weather_search_label"
            value={form.weather_search_label}
            onChange={onChange}
            placeholder="Dakar, Senegal"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={grid3}>
        <label style={labelStyle}>
          <span>City</span>
          <input
            name="weather_city"
            value={form.weather_city}
            onChange={onChange}
            placeholder="Dakar"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>Region / State</span>
          <input
            name="weather_region"
            value={form.weather_region}
            onChange={onChange}
            placeholder="Dakar Region"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>Country</span>
          <input
            name="weather_country"
            value={form.weather_country}
            onChange={onChange}
            placeholder="Senegal"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={grid3}>
        <label style={labelStyle}>
          <span>Latitude</span>
          <input
            name="weather_lat"
            value={form.weather_lat}
            onChange={onChange}
            placeholder="14.7167"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>Longitude</span>
          <input
            name="weather_lng"
            value={form.weather_lng}
            onChange={onChange}
            placeholder="-17.4677"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span>Timezone</span>
          <input
            name="weather_timezone"
            value={form.weather_timezone}
            onChange={onChange}
            placeholder="Africa/Dakar"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={grid2}>
        <label style={labelStyle}>
          <span>Sort Order</span>
          <input
            name="weather_sort_order"
            value={form.weather_sort_order}
            onChange={onChange}
            placeholder="1"
            style={inputStyle}
          />
        </label>

        <div />
      </div>

      <label style={labelStyle}>
        <span>Location Note</span>
        <textarea
          name="location_note"
          value={form.location_note}
          onChange={onChange}
          placeholder="Optional note about why this place is connected to this song."
          style={textareaStyle}
        />
      </label>
    </section>
  );
}

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const grid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  color: "white",
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  padding: "10px 12px",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 96,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  padding: "12px",
  resize: "vertical",
};
