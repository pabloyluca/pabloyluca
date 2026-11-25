"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Dialog({
  title,
  onClose,
  children,
  variant = "sheet",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  variant?: "sheet" | "side";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const callback = useRef(onClose);
  useEffect(() => {
    callback.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
      trigger?.focus();
    };
  }, []);
  return (
    <dialog
      className={`pl-dialog pl-dialog-${variant}`}
      aria-label={title}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        callback.current();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const rect = ref.current.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            callback.current();
        }
      }}
    >
      <div className="pl-dialog-head">
        <h2>{title}</h2>
        <button
          className="pl-icon-btn"
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
