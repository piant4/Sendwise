"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type TextareaHTMLAttributes,
} from "react";

interface CampaignCodeEditorProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onFocus?: FocusEventHandler<HTMLTextAreaElement>;
}

const CODE_EDITOR_LINE_HEIGHT = 21;
const CODE_EDITOR_TOP_PADDING = 16;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function highlightCode(value: string): string {
  const escaped = escapeHtml(value);

  return escaped
    .replace(
      /(&lt;!--[\s\S]*?--&gt;)/g,
      '<span class="campaign-code-editor__token campaign-code-editor__token--comment">$1</span>',
    )
    .replace(
      /(\{\{\s*[\w.:-]+\s*\}\})/g,
      '<span class="campaign-code-editor__token campaign-code-editor__token--placeholder">$1</span>',
    )
    .replace(
      /(&lt;\/?[\w:-]+(?:\s+[\w:-]+(?:=(?:"[^"]*"|'[^']*'))?)*\s*\/?&gt;)/g,
      '<span class="campaign-code-editor__token campaign-code-editor__token--tag">$1</span>',
    );
}

export const CampaignCodeEditor = forwardRef<
  HTMLTextAreaElement,
  CampaignCodeEditorProps
>(function CampaignCodeEditor(
  { className, onChange, onFocus, rows = 18, value, ...props },
  forwardedRef,
) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const [activeLine, setActiveLine] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const lineNumbers = useMemo(() => {
    const total = Math.max(value.split("\n").length, Number(rows));
    return Array.from({ length: total }, (_value, index) => index + 1);
  }, [rows, value]);
  const highlightedValue = useMemo(() => {
    const markup = highlightCode(value);
    return markup.length > 0 ? markup : " ";
  }, [value]);
  const activeLineOffset =
    CODE_EDITOR_TOP_PADDING + (activeLine - 1) * CODE_EDITOR_LINE_HEIGHT - scrollTop;

  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, []);

  const syncActiveLine = useCallback((selectionStart: number) => {
    const nextLine = value.slice(0, selectionStart).split("\n").length;
    setActiveLine(nextLine);
  }, [value]);

  const updateSelectionState = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    syncActiveLine(textarea.selectionStart ?? 0);
  }, [syncActiveLine]);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      if (event.key !== "Tab") {
        props.onKeyDown?.(event);
        return;
      }

      event.preventDefault();

      const textarea = event.currentTarget;
      const selectionStart = textarea.selectionStart ?? 0;
      const selectionEnd = textarea.selectionEnd ?? selectionStart;
      const currentValue = textarea.value;

      if (!event.shiftKey) {
        const insertion = "  ";
        const nextValue = `${currentValue.slice(0, selectionStart)}${insertion}${currentValue.slice(selectionEnd)}`;
        onChange(nextValue);

        window.requestAnimationFrame(() => {
          textarea.focus();
          const caret = selectionStart + insertion.length;
          textarea.setSelectionRange(caret, caret);
          syncActiveLine(caret);
        });
        return;
      }

      const lineStart = currentValue.lastIndexOf("\n", selectionStart - 1) + 1;
      const selectedBlock = currentValue.slice(lineStart, selectionEnd);
      const lines = selectedBlock.split("\n");
      let removed = 0;
      const nextBlock = lines
        .map((line) => {
          if (line.startsWith("  ")) {
            removed += 2;
            return line.slice(2);
          }
          if (line.startsWith(" ")) {
            removed += 1;
            return line.slice(1);
          }
          return line;
        })
        .join("\n");

      const nextValue = `${currentValue.slice(0, lineStart)}${nextBlock}${currentValue.slice(selectionEnd)}`;
      onChange(nextValue);

      window.requestAnimationFrame(() => {
        textarea.focus();
        const nextSelectionStart = Math.max(lineStart, selectionStart - Math.min(2, selectionStart - lineStart));
        const nextSelectionEnd = Math.max(nextSelectionStart, selectionEnd - removed);
        textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
        syncActiveLine(nextSelectionStart);
      });
    },
    [onChange, props, syncActiveLine],
  );

  const handlePointerSync: MouseEventHandler<HTMLTextAreaElement> = useCallback(() => {
    window.requestAnimationFrame(updateSelectionState);
  }, [updateSelectionState]);

  return (
    <div className={`campaign-code-editor${className ? ` ${className}` : ""}`}>
      <div ref={gutterRef} aria-hidden="true" className="campaign-code-editor__gutter">
        {lineNumbers.map((lineNumber) => (
          <span
            key={lineNumber}
            className="campaign-code-editor__line-number"
            data-active={lineNumber === activeLine}
          >
            {lineNumber}
          </span>
        ))}
      </div>
      <div className="campaign-code-editor__stage">
        <div
          aria-hidden="true"
          className="campaign-code-editor__active-line"
          style={{ transform: `translateY(${activeLineOffset}px)` }}
        />
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="campaign-code-editor__highlight"
          dangerouslySetInnerHTML={{ __html: highlightedValue }}
        />
      </div>
      <textarea
        {...props}
        ref={textareaRef}
        className="campaign-code-editor__textarea"
        rows={rows}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        data-gramm="false"
        data-lpignore="true"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          onFocus?.(event);
          updateSelectionState();
        }}
        onClick={handlePointerSync}
        onKeyDown={handleKeyDown}
        onKeyUp={updateSelectionState}
        onSelect={updateSelectionState}
        onMouseUp={handlePointerSync}
        onScroll={(event) => {
          if (gutterRef.current) {
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }
          if (highlightRef.current) {
            highlightRef.current.scrollTop = event.currentTarget.scrollTop;
            highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
          }
          setScrollTop(event.currentTarget.scrollTop);
        }}
      />
    </div>
  );
});
