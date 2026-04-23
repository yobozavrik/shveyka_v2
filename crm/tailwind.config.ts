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
        // Linear color tokens
        background: "var(--bg-base)",
        foreground: "var(--text-1)",

        // Surfaces
        surface: {
          DEFAULT: "var(--bg-card)",
          elevated: "var(--bg-card2)",
          hover: "var(--bg-hover)",
        },

        // Text hierarchy
        text: {
          primary: "var(--text-1)",
          secondary: "var(--text-2)",
          muted: "var(--text-3)",
          disabled: "var(--text-4)",
        },

        // Brand
        brand: {
          DEFAULT: "var(--primary)",    // #5e6ad2
          accent: "var(--accent)",      // #7170ff
          hover: "var(--accent-hover)", // #828fff
        },

        // Border
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
          solid: "var(--border-solid)",
          solid2: "var(--border-solid2)",
          line: "var(--line-tint)",
        },

        // Status
        success: {
          DEFAULT: "var(--success)",
          emerald: "var(--success-em)",
        },
      },

      // Linear border radius scale
      borderRadius: {
        micro: '2px',
        standard: '4px',
        comfortable: '6px',
        card: '8px',
        panel: '12px',
        large: '22px',
      },

      // Font weight — standard values
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
      },
    },
  },
  plugins: [],
} satisfies Config;
