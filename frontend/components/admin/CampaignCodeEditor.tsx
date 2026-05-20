"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type FocusEventHandler,
  type TextareaHTMLAttributes,
} from "react";

interface CampaignCodeEditorProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onFocus?: FocusEventHandler<HTMLTextAreaElement>;
}

export const CampaignCodeEditor = forwardRef<
  HTMLTextAreaElement,
  CampaignCodeEditorProps
>(function CampaignCodeEditor(
  { className, onChange, onFocus, rows = 18, value, ...props },
  forwardedRef,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLPreElement | null>(null);
  const lineNumbers = useMemo(() => {
    const total = Math.max(value.split("\n").length, Number(rows));
    return Array.from({ length: total }, (_value, index) => index + 1).join("\n");
  }, [rows, value]);

  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, []);

  return (
    <div className={`campaign-code-editor${className ? ` ${className}` : ""}`}>
      <pre
        ref={gutterRef}
        aria-hidden="true"
        className="campaign-code-editor__gutter"
      >
        {lineNumbers}
      </pre>
      <textarea
        {...props}
        ref={textareaRef}
        className="campaign-code-editor__textarea"
        rows={rows}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onScroll={(event) => {
          if (gutterRef.current) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }
        }}
      />
    </div>
  );
});
