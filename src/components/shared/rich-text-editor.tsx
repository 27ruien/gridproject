import { useEffect, useRef } from "react";
import { Bold, Code2, Italic, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RichTextEditor({
  value,
  onChange,
  placeholder = "输入说明",
  className,
  minHeight = "min-h-28",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  function sync() {
    onChange(editorRef.current?.innerHTML || "");
  }

  function command(name: string, payload?: string) {
    editorRef.current?.focus();
    document.execCommand(name, false, payload);
    sync();
  }

  function insertHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    sync();
  }

  return (
    <div className={cn("overflow-hidden rounded-md border bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30", className)}>
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-2 py-1">
        <Button type="button" size="icon-xs" variant="ghost" aria-label="加粗" onClick={() => command("bold")}><Bold /></Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label="斜体" onClick={() => command("italic")}><Italic /></Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label="无序列表" onClick={() => command("insertUnorderedList")}><List /></Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label="代码块" onClick={() => insertHtml("<pre><code><br></code></pre>")}><Code2 /></Button>
      </div>
      <div
        ref={editorRef}
        className={cn(
          "px-3 py-2 text-sm outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_figcaption]:mt-1 [&_figcaption]:text-xs [&_figcaption]:text-muted-foreground",
          "[&_figure]:my-2 [&_img]:max-h-64 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_ul]:list-disc [&_ul]:pl-5",
          minHeight,
        )}
        contentEditable
        data-placeholder={placeholder}
        onInput={sync}
      />
    </div>
  );
}

export function RichTextView({ value, className }: { value?: string | null; className?: string }) {
  if (!value) return <span className={className}>无说明</span>;
  return (
    <div
      className={cn(
        "text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_figcaption]:text-xs [&_figcaption]:text-muted-foreground [&_img]:max-h-72 [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }}
    />
  );
}

export function plainRichText(value?: string | null) {
  if (!value) return "无说明";
  if (typeof document === "undefined") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "无说明";
  const container = document.createElement("div");
  container.innerHTML = value;
  return container.textContent?.replace(/\s+/g, " ").trim() || "无说明";
}

export function sanitizeRichHtml(value?: string | null) {
  if (!value) return "";
  if (typeof DOMParser === "undefined") return escapeHtml(plainRichText(value));
  const doc = new DOMParser().parseFromString(value, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed").forEach((node) => node.remove());
  doc.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const content = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "src") && content.startsWith("javascript:"))) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return doc.body.innerHTML;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
