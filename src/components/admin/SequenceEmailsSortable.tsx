import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getApiUrl } from '../../lib/api';

export interface EmailAttachment {
    filename: string;
    path: string;
}

export interface SequenceEmail {
    id: number;
    sequence_id: number;
    position: number;
    subject: string;
    body: string;
    delay_days: number;
    delay_hours: number;
    subject_am?: string | null;
    body_am?: string | null;
    subject_en?: string | null;
    body_en?: string | null;
    conditions?: { previous_email_opened?: boolean; has_tags?: string[]; not_has_tags?: string[] } | null;
    attachments?: EmailAttachment[] | null;
    stats?: { sent: number; opened: number; clicked: number };
}

function SortableSequenceStep({
    em,
    onEdit,
    onDelete,
}: {
    em: SequenceEmail;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: em.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex justify-between items-start py-3 border-b border-border last:border-0 ${isDragging ? 'opacity-60 z-10' : ''}`}
        >
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="cursor-grab touch-none text-muted hover:text-foreground" {...attributes} {...listeners} title="Drag to reorder">
                    <span className="material-symbols-outlined text-lg">drag_indicator</span>
                </span>
                <div className="min-w-0">
                    <span className="text-muted text-sm mr-2">#{em.position}</span>
                    <span className="font-medium">{em.subject}</span>
                    <p className="text-muted text-xs mt-1">Delay: {em.delay_days}d {em.delay_hours}h</p>
                    {em.stats && em.stats.sent > 0 && (
                        <p className="text-xs mt-1">
                            <span className="text-purple-400">Sent {em.stats.sent}</span>
                            <span className="text-emerald-400 ml-2">Opened {em.stats.opened}</span>
                            <span className="text-blue-400 ml-2">Clicked {em.stats.clicked}</span>
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={onEdit} className="px-3 py-1.5 bg-primary/20 text-primary rounded text-sm hover:bg-primary/30">Edit</button>
                <button onClick={onDelete} className="px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded text-sm hover:bg-rose-500/30">Delete</button>
            </div>
        </div>
    );
}

export interface SequenceEmailsSortableProps {
    sequenceEmails: SequenceEmail[];
    setSequenceEmails: React.Dispatch<React.SetStateAction<SequenceEmail[]>>;
    selectedSequenceId: number | null;
    fetchWithAdminAuth: (url: string, opts: RequestInit) => Promise<Response>;
    setEditingSequenceEmailId: (id: number | null) => void;
    setSequenceEmailForm: (form: {
        subject: string;
        body: string;
        delay_days: number;
        delay_hours: number;
        subject_am: string;
        body_am: string;
        subject_en: string;
        body_en: string;
        conditions: { previous_email_opened?: boolean; has_tags?: string[]; not_has_tags?: string[] } | null;
        attachments?: EmailAttachment[];
    }) => void;
    deleteSequenceEmail: (seqId: number, emailId: number) => Promise<void>;
    setMessage: (msg: string) => void;
}

export function SequenceEmailsSortable({
    sequenceEmails,
    setSequenceEmails,
    selectedSequenceId,
    fetchWithAdminAuth,
    setEditingSequenceEmailId,
    setSequenceEmailForm,
    deleteSequenceEmail,
    setMessage,
}: SequenceEmailsSortableProps) {
    const dndSensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

    return (
        <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={async (event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const oldIndex = sequenceEmails.findIndex((e) => e.id === active.id);
                const newIndex = sequenceEmails.findIndex((e) => e.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return;
                const arr = [...sequenceEmails];
                const [removed] = arr.splice(oldIndex, 1);
                arr.splice(newIndex, 0, removed);
                const reordered = arr.map((item, idx) => ({ ...item, position: idx + 1 }));
                setSequenceEmails(reordered);
                try {
                    await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${selectedSequenceId}/emails/reorder`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderedIds: arr.map((e) => e.id) }),
                    });
                    setMessage('Order saved');
                } catch {
                    setSequenceEmails(sequenceEmails);
                    setMessage('Failed to save order');
                }
            }}
        >
            <SortableContext items={sequenceEmails.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                    {sequenceEmails.map((em) => (
                        <SortableSequenceStep
                            key={em.id}
                            em={em}
                            onEdit={() => {
                                setEditingSequenceEmailId(em.id);
                                setSequenceEmailForm({
                                    subject: em.subject,
                                    body: em.body,
                                    delay_days: em.delay_days,
                                    delay_hours: em.delay_hours,
                                    subject_am: em.subject_am || '',
                                    body_am: em.body_am || '',
                                    subject_en: em.subject_en || '',
                                    body_en: em.body_en || '',
                                    conditions: em.conditions || null,
                                    attachments: em.attachments || [],
                                });
                            }}
                            onDelete={() => selectedSequenceId != null && deleteSequenceEmail(selectedSequenceId, em.id)}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
