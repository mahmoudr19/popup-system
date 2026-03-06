# Shopify High-Converting Popup System

A modern, fast, and accessible popup system designed specifically for Shopify themes. This system provides a two-step approach (Awareness & Conversion) to maximize user engagement without being intrusive.

## 🌟 Key Features

- **Built with Web Components:** Encapsulated logic using `<popup-system>` for clean DOM and zero global conflicts.
- **Two-Step Strategy Supported:**
  - **Awareness Popup:** A visually engaging image-only popup to grab attention.
  - **Conversion Popup:** A focused popup containing a prominent promo code that users can click to copy.
- **Advanced Trigger Logic:** 
  - Session-based delay logic ensures the optimal timing for showing the conversion popup.
  - Prevents annoying immediate popups by waiting for user engagement.
- **Fully Accessible (A11y):**
  - Smart focus trapping for keyboard navigation.
  - Full screen reader support (`aria-hidden`, `aria-live`, `role="dialog"`).
  - Esc key support for dismissing.
  - Reduced motion support (`prefers-reduced-motion`).
- **Scroll Management:** Locks body scrolling perfectly when the popup is open, handling scrollbar shift seamlessly.
- **Dynamic Content Integration:** Fully integrated with Shopify's Section/Block Schema for easy customization via the Theme Editor.

## 📁 File Structure

| File | Description | location |
|------|-------------|----------|
| `popup.js` | The core Web Component Javascript handling logic and events. | `assets/` |
| `popup-system.liquid` | The main section wrapper including inline CSS and Section Schema. | `sections/` |
| `popup-base.liquid` | A reusable snippet to render the HTML structure for both popup types. | `snippets/` |

## 🚀 Installation Guide

1. **Add `popup.js`:**
   Upload the `popup.js` file into your theme's `assets/` folder.
   
2. **Add `popup-base.liquid`:**
   Upload the `popup-base.liquid` file into your theme's `snippets/` folder.

3. **Add `popup-system.liquid`:**
   Upload the `popup-system.liquid` file into your theme's `sections/` folder.

4. **Add to Theme:**
   Open the Shopify Theme Customizer. Click **Add Section** and select **Popup system**. You can also include it globally in your `theme.liquid` layout just before the closing `</body>` tag:
   ```liquid
   {% section 'popup-system' %}
   ```

## ⚙️ How it Works

The JS file registers a custom element `<popup-system>`. 

### Awareness Workflow
Displays first after a set delay (stored in `sessionStorage`). Useful to highlight a new collection or brand message.

### Conversion Workflow
Displays after the user has seen the Awareness popup (or after a longer delay), presenting a promo code. Clicking the promo code automatically copies it to the user's clipboard (stored in `localStorage` to prevent showing it again for converted users).

## 🛠 Features Breakdown

### Web Component Properties
- `data-lock-scroll`: Determines if the background should be locked from scrolling.
- `data-overlay-close`: Closes the popup if the user clicks outside the dialog area.
- `data-storage-type`: Choose between `session` or `local` for state persistence.
- `data-auto-close`: Automatically dismisses the popup after `X` seconds.

### Theming
All major styles are controlled via CSS custom properties passed inline, which makes the popup system easily style-able directly from the Shopify Schema.

## 📄 License
MIT License. Free to use and modify.
