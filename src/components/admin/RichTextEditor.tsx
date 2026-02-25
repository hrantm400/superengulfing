import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import LoadingSpinner from '../ui/LoadingSpinner';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
    minHeight?: string;
    /** Upload image file to server; returns URL or null. If provided, paste/drop of images will upload and insert. */
    onUploadImage?: (file: File) => Promise<string | null>;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

export function RichTextEditor({ value, onChange, placeholder, className = '', minHeight = '120px', onUploadImage }: RichTextEditorProps) {
    const onUploadImageRef = useRef(onUploadImage);
    const editorRef = useRef<ReturnType<typeof useEditor>>(null);
    onUploadImageRef.current = onUploadImage;

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder: placeholder || 'Enter content... Use {{first_name}}, {{email}}, {{unsubscribe_url}} for merge tags.' }),
            Image.configure({ inline: false, allowBase64: false }),
            Link.configure({
                autolink: true,
                linkOnPaste: true,
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 underline',
                },
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[100px] p-3',
            },
            handlePaste(_view, event) {
                const items = event.clipboardData?.items;
                if (!items || !onUploadImageRef.current) return false;
                for (let i = 0; i < items.length; i++) {
                    const file = items[i].getAsFile();
                    if (file && IMAGE_TYPES.includes(file.type)) {
                        event.preventDefault();
                        onUploadImageRef.current(file).then((url) => {
                            const ed = editorRef.current;
                            if (url && ed) ed.chain().focus().setImage({ src: url }).run();
                        });
                        return true;
                    }
                }
                return false;
            },
            handleDrop(_view, event) {
                const files = event.dataTransfer?.files;
                if (!files?.length || !onUploadImageRef.current) return false;
                const file = files[0];
                if (file && IMAGE_TYPES.includes(file.type)) {
                    event.preventDefault();
                    onUploadImageRef.current(file).then((url) => {
                        const ed = editorRef.current;
                        if (url && ed) ed.chain().focus().setImage({ src: url }).run();
                    });
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    }, []);
    (editorRef as React.MutableRefObject<ReturnType<typeof useEditor> | null>).current = editor;

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value, false);
        }
    }, [value, editor]);

    const setLink = () => {
        if (!editor) return;
        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('Enter link URL', previousUrl || 'https://');
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    const unsetLink = () => {
        if (!editor) return;
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
    };

    const handleContextMenu: React.MouseEventHandler<HTMLDivElement> = (event) => {
        if (!editor) return;
        // If right-click happens while selection is inside a link, offer to remove the link
        if (editor.isActive('link')) {
            event.preventDefault();
            const shouldRemove = window.confirm('Remove link from selected text?');
            if (shouldRemove) {
                editor.chain().focus().extendMarkRange('link').unsetLink().run();
            }
        }
    };

    if (!editor) {
        return (
            <div
                className={`bg-background border border-border rounded-lg font-mono text-sm flex items-center justify-center min-h-[120px] ${className}`}
                style={{ minHeight }}
            >
                <LoadingSpinner />
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
                <button
                    type="button"
                    onClick={setLink}
                    className={`px-2 py-1 rounded text-sm ${editor.isActive('link') ? 'bg-primary/20 text-primary' : 'hover:bg-surfaceElevated'}`}
                >
                    Add link
                </button>
                <button
                    type="button"
                    onClick={unsetLink}
                    disabled={!editor.isActive('link')}
                    className={`px-2 py-1 rounded text-sm ${
                        editor.isActive('link')
                            ? 'hover:bg-surfaceElevated'
                            : 'opacity-40 cursor-not-allowed'
                    }`}
                >
                    Remove link
                </button>
            </div>
            <EditorContent editor={editor} onContextMenu={handleContextMenu} />
        </div>
    );
}
