import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // GOV.UK-inspired colour palette
        govuk: {
          blue: "#1d70b8",
          "dark-blue": "#003078",
          "light-blue": "#5694ca",
          red: "#d4351c",
          yellow: "#ffdd00",
          green: "#00703c",
          "light-green": "#85994b",
          purple: "#4c2c92",
          black: "#0b0c0e",
          "dark-grey": "#505a5f",
          "mid-grey": "#b1b4b6",
          "light-grey": "#f3f2f1",
          white: "#ffffff",
        },
        // Council branding
        council: {
          primary: "#1d70b8",
          secondary: "#003078",
          accent: "#00703c",
          danger: "#d4351c",
          warning: "#ffdd00",
          success: "#00703c",
          muted: "#505a5f",
          background: "#f3f2f1",
          surface: "#ffffff",
        },
      },
      fontFamily: {
        sans: ['"GDS Transport"', '"Noto Sans"', "Arial", "sans-serif"],
      },
      fontSize: {
        "govuk-xl": ["2rem", { lineHeight: "1.15", fontWeight: "700" }],
        "govuk-l": ["1.5rem", { lineHeight: "1.25", fontWeight: "700" }],
        "govuk-m": ["1.1875rem", { lineHeight: "1.3", fontWeight: "700" }],
        "govuk-s": ["1rem", { lineHeight: "1.5", fontWeight: "400" }],
        "govuk-xs": ["0.875rem", { lineHeight: "1.5", fontWeight: "400" }],
      },
      maxWidth: {
        "govuk-container": "960px",
        "govuk-two-thirds": "640px",
      },
    },
  },
  plugins: [],
};
export default config;
