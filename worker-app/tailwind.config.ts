import type { Config } from "tailwindcss";

export default {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          container: "var(--primary-container)",
          fixed: "#85f8c4",
          "fixed-dim": "#68dba9",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          container: "var(--secondary-container)",
        },
        tertiary: {
          DEFAULT: "var(--tertiary)",
        },
        error: {
          DEFAULT: "var(--error)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          bright: "var(--surface)",
          dim: "var(--surface-dim)",
          container: {
            lowest: "var(--surface-container-lowest)",
            low: "var(--surface-container-low)",
            DEFAULT: "var(--surface-container)",
            high: "var(--surface-container-high)",
            highest: "var(--surface-container-highest)",
          }
        },
        "on-surface": "var(--on-surface)",
        "on-surface-variant": "var(--on-surface-variant)",
        background: "var(--background)",
        outline: {
          DEFAULT: "var(--outline)",
          variant: "var(--outline-variant)",
        },
      },
      fontFamily: {
        headline: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        label: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
} satisfies Config;
