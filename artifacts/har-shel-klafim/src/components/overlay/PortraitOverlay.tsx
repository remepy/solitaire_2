import "./portrait-overlay.css";
import React from "react";

interface PortraitOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /**
   * The message shown below the animation.
   * Defaults to the Hebrew "סובבו את הטלפון למצב מאוזן"
   * ("Rotate the phone to landscape").
   */
  message?: string;
}

/**
 * Full-screen overlay shown on mobile devices in portrait orientation.
 * Asks the user to rotate to landscape before continuing.
 *
 * Usage:
 *   import { useIsRotated } from "./useIsRotated";
 *   import { PortraitOverlay } from "./PortraitOverlay";
 *   import "./portrait-overlay.css";
 *
 *   const isPortrait = useIsRotated();
 *   <PortraitOverlay visible={isPortrait} />
 *   // or with a custom message:
 *   <PortraitOverlay visible={isPortrait} message="Please rotate your phone" />
 */
export function PortraitOverlay({
  visible,
  message = "סובבו את הטלפון למצב מאוזן",
}: PortraitOverlayProps) {
  if (!visible) return null;

  return (
    <div className="portrait-overlay" aria-live="polite" role="status">
      <div className="portrait-overlay__content">
        {/* Animated phone-rotate SVG */}
        <svg
          className="portrait-overlay__icon"
          viewBox="0 0 58 73"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Phone body */}
          <path d="M14.543 17.1098C14.543 15.6634 15.0321 14.2763 15.9028 13.2535C16.7735 12.2308 17.9545 11.6563 19.1858 11.6562H37.7573C38.9886 11.6563 40.1695 12.2308 41.0402 13.2535C41.911 14.2763 42.4001 15.6634 42.4001 17.1098V55.2844C42.4001 56.7307 41.911 58.1179 41.0402 59.1406C40.1695 60.1633 38.9886 60.7379 37.7573 60.7379H19.1858C17.9545 60.7379 16.7735 60.1633 15.9028 59.1406C15.0321 58.1179 14.543 56.7307 14.543 55.2844V17.1098Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Top notch */}
          <path d="M31.1811 15.8574H25.4727H32.1809" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Top-right rotation arrow */}
          <path d="M43.6919 2.48089C45.6026 2.11271 47.5819 2.45348 49.2593 3.43941C50.9368 4.42534 52.1975 5.98883 52.8053 7.83721C53.4132 9.68559 53.3265 11.6921 52.5616 13.4813M56.4433 10.2902L52.916 13.834L49.3722 10.3067" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Bottom-left rotation arrow */}
          <path d="M14.0491 69.678C12.1545 70.1212 10.1633 69.8587 8.44826 68.9396C6.73323 68.0206 5.41193 66.508 4.73171 64.685C4.05149 62.862 4.05898 60.8536 4.75277 59.0358M0.999921 62.3773L4.38477 58.6973L8.06482 62.0821" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        <p className="portrait-overlay__text">{message}</p>
      </div>
    </div>
  );
}
