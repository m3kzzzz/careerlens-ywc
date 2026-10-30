"use client";

import { useId } from "react";
import { FILE_INPUT_ACCEPT } from "@/lib/upload/constants";

interface FilePickerProps {
  /** "camera" opens the rear camera on phones; "library" opens the gallery / file dialog. */
  mode: "camera" | "library";
  onFiles: (files: File[]) => void;
  /**
   * Also list file extensions in `accept` (desktop only). Desktop pickers need
   * them to show HEIC files on Windows, but on Android an extension list can
   * swap the camera/gallery chooser for a generic file browser.
   */
  withExtensions?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}

/**
 * A styled <label> wrapping a hidden file input, so the whole card is the
 * touch target (as in the design) while staying keyboard accessible.
 */
export function FilePicker({ mode, onFiles, withExtensions = false, disabled, className, children, ...rest }: FilePickerProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={rest["aria-label"]}
      className={className}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          (document.getElementById(id) as HTMLInputElement | null)?.click();
        }
      }}
    >
      {children}
      <input
        id={id}
        type="file"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        accept={mode === "library" && withExtensions ? FILE_INPUT_ACCEPT : "image/*"}
        multiple={mode === "library"}
        {...(mode === "camera" ? { capture: "environment" as const } : {})}
        onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          // Reset so picking the same file again still fires onChange.
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}
