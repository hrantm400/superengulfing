import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    minHeight?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className = '', minHeight = '120px' }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: placeholder || 'Enter content... Use {{first_name}}, {{email}}, {{unsubscribe_url}} for merge tags.' }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] p-3',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    }, []);

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value, false);
        }
    }, [value, editor]);

    if (!editor) {
        return (
            <div
                className={`bg-background border border-border rounded-lg font-mono text-sm ${className}`}
                style={{ minHeight }}
            >
                <div className="p-3 text-muted">Loading editor…</div>
            </div>
        );
    }

    return (
        <div
            className={`bg-background border border-border rounded-lg text-foreground focus-within:ring-2 focus-within:ring-primary focus-within:border-primary ${className}`}
            style={{ minHeight }}
        >
            <div className="flex border-b border-border px-2 py-1 gap-1 flex-wrap">
                <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`px-2 py-1 rounded text-sm ${editor.isActive('bold') ? 'bg-primary/20 text-primary' : 'hover:bg-surfaceElevated'}`}>Bold</button>
                <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-2 py-1 rounded text-sm ${editor.isActive('italic') ? 'bg-primary/20 text-primary' : 'hover:bg-surfaceElevated'}`}>Italic</button>
                <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-2 py-1 rounded text-sm ${editor.isActive('bulletList') ? 'bg-primary/20 text-primary' : 'hover:bg-surfaceElevated'}`}>List</button>
                <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className="px-2 py-1 rounded text-sm hover:bg-surfaceElevated">Paragraph</button>
                <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-2 py-1 rounded text-sm ${editor.isActive('heading', { level: 2 }) ? 'bg-primary/20 text-primary' : 'hover:bg-surfaceElevated'}`}>H2</button>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
