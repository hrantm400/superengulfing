import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Pencil, Trash2, ListVideo, X } from 'lucide-react';
import { getApiUrl } from '../../lib/api';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

const API_URL = getApiUrl();

interface CourseRow {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  lesson_count: string;
}

interface LessonRow {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  position: number;
  video_type: string;
  video_url: string;
}

interface LessonResourceRow {
  id: number;
  lesson_id: number;
  title: string;
  url: string;
}

interface AdminCoursesProps {
  setMessage: (msg: string) => void;
  adminAudienceLocale: 'en' | 'am';
}

export const AdminCourses: React.FC<AdminCoursesProps> = ({ setMessage, adminAudienceLocale }) => {
  const { fetchWithAdminAuth } = useAdminAuth();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [courseForm, setCourseForm] = useState({ title: '', description: '', image_url: '' });
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [lessonsForCourseId, setLessonsForCourseId] = useState<number | null>(null);
  const [lessonsForCourseTitle, setLessonsForCourseTitle] = useState('');
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', position: 0, video_type: 'youtube' as 'youtube' | 'wistia', video_url: '' });
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonResources, setLessonResources] = useState<LessonResourceRow[]>([]);
  const [resourceForm, setResourceForm] = useState({ title: '', url: '' });

  const loadCourses = () => {
    fetchWithAdminAuth(`${API_URL}/api/courses?locale=${adminAudienceLocale}`)
      .then((r) => r.json())
      .then((d) => setCourses(d.courses || []))
      .catch(() => setCourses([]));
  };

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminAudienceLocale]);

  useEffect(() => {
    if (lessonsForCourseId != null) {
      fetchWithAdminAuth(`${API_URL}/api/courses/${lessonsForCourseId}/lessons`)
        .then((r) => r.json())
        .then((d) => setLessons(d.lessons || []))
        .catch(() => setLessons([]));
    } else {
      setLessons([]);
    }
  }, [lessonsForCourseId]);

  useEffect(() => {
    if (editingLessonId != null && showLessonModal) {
      fetchWithAdminAuth(`${API_URL}/api/lessons/${editingLessonId}/resources`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setLessonResources(d.resources || []))
        .catch(() => setLessonResources([]));
    } else {
      setLessonResources([]);
      setResourceForm({ title: '', url: '' });
    }
  }, [editingLessonId, showLessonModal]);

  const totalLessons = courses.reduce((acc, c) => acc + parseInt(c.lesson_count || '0', 10), 0);

  const openAddCourse = () => {
    setCourseForm({ title: '', description: '', image_url: '' });
    setEditingCourseId(null);
    setShowCourseModal(true);
  };

  const openEditCourse = (c: CourseRow) => {
    setCourseForm({ title: c.title, description: c.description || '', image_url: c.image_url || '' });
    setEditingCourseId(c.id);
    setShowCourseModal(true);
  };

  const saveCourse = async () => {
    if (!courseForm.title.trim()) {
      setMessage('Title required');
      return;
    }
    try {
      if (editingCourseId) {
        await fetchWithAdminAuth(`${API_URL}/api/courses/${editingCourseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: courseForm.title.trim(),
            description: courseForm.description.trim() || null,
            image_url: courseForm.image_url.trim() || null,
          }),
        });
        setMessage('Course updated');
      } else {
        await fetchWithAdminAuth(`${API_URL}/api/courses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: courseForm.title.trim(),
            description: courseForm.description.trim() || null,
            image_url: courseForm.image_url.trim() || null,
            locale: adminAudienceLocale,
          }),
        });
        setMessage('Course created');
      }
      setShowCourseModal(false);
      loadCourses();
    } catch (e) {
      setMessage('Failed to save course');
    }
  };

  const deleteCourse = async (id: number, title: string) => {
    if (!confirm(`Delete course "${title}" and all its lessons?`)) return;
    try {
      await fetchWithAdminAuth(`${API_URL}/api/courses/${id}?locale=${adminAudienceLocale}`, { method: 'DELETE' });
      setMessage('Course deleted');
      setCourses((prev) => prev.filter((x) => x.id !== id));
      if (lessonsForCourseId === id) {
        setLessonsForCourseId(null);
      }
    } catch (e) {
      setMessage('Failed to delete');
    }
  };

  const openManageLessons = (c: CourseRow) => {
    setLessonsForCourseId(c.id);
    setLessonsForCourseTitle(c.title);
    setEditingLessonId(null);
    setLessonForm({ title: '', description: '', position: lessons.length, video_type: 'youtube', video_url: '' });
    setShowLessonModal(false);
  };

  const openAddLesson = () => {
    setLessonForm({ title: '', description: '', position: lessons.length, video_type: 'youtube', video_url: '' });
    setEditingLessonId(null);
    setLessonResources([]);
    setResourceForm({ title: '', url: '' });
    setShowLessonModal(true);
  };

  const openEditLesson = (l: LessonRow) => {
    setResourceForm({ title: '', url: '' });
    setLessonForm({
      title: l.title,
      description: l.description || '',
      position: l.position,
      video_type: l.video_type as 'youtube' | 'wistia',
      video_url: l.video_url,
    });
    setEditingLessonId(l.id);
    setShowLessonModal(true);
  };

  const saveLesson = async () => {
    if (!lessonForm.title.trim() || !lessonForm.video_url.trim()) {
      setMessage('Title and video URL required');
      return;
    }
    if (lessonsForCourseId == null) return;
    try {
      if (editingLessonId) {
        await fetchWithAdminAuth(`${API_URL}/api/lessons/${editingLessonId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: lessonForm.title.trim(),
            description: lessonForm.description.trim() || null,
            position: lessonForm.position,
            video_type: lessonForm.video_type,
            video_url: lessonForm.video_url.trim(),
          }),
        });
        setMessage('Lesson updated');
      } else {
        await fetchWithAdminAuth(`${API_URL}/api/courses/${lessonsForCourseId}/lessons`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: lessonForm.title.trim(),
            description: lessonForm.description.trim() || null,
            position: lessonForm.position,
            video_type: lessonForm.video_type,
            video_url: lessonForm.video_url.trim(),
          }),
        });
        setMessage('Lesson added');
      }
      setShowLessonModal(false);
      fetchWithAdminAuth(`${API_URL}/api/courses/${lessonsForCourseId}/lessons`).then((r) => r.json()).then((d) => {
        setLessons(d.lessons || []);
      });
      loadCourses();
    } catch (e) {
      setMessage('Failed to save lesson');
    }
  };

  const deleteLesson = async (l: LessonRow) => {
    if (!confirm(`Delete lesson "${l.title}"?`)) return;
    try {
      await fetchWithAdminAuth(`${API_URL}/api/lessons/${l.id}`, { method: 'DELETE' });
      setMessage('Lesson deleted');
      setLessons((prev) => prev.filter((x) => x.id !== l.id));
      loadCourses();
    } catch (e) {
      setMessage('Failed to delete lesson');
    }
  };

  const addLessonResource = async () => {
    if (!editingLessonId || !resourceForm.title.trim() || !resourceForm.url.trim()) {
      setMessage('Title and URL required');
      return;
    }
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/api/lessons/${editingLessonId}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: resourceForm.title.trim(), url: resourceForm.url.trim() }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || `Failed to add resource (${res.status})`);
        return;
      }
      setResourceForm({ title: '', url: '' });
      const r = await fetchWithAdminAuth(`${API_URL}/api/lessons/${editingLessonId}/resources`, { credentials: 'include' });
      const d = await r.json();
      setLessonResources(d.resources || []);
      setMessage('Resource added');
    } catch (e) {
      setMessage('Failed to add resource');
    }
  };

  const deleteLessonResource = async (id: number) => {
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/api/lesson-resources/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) return setMessage('Failed to remove resource');
      setLessonResources((prev) => prev.filter((x) => x.id !== id));
      setMessage('Resource removed');
    } catch (e) {
      setMessage('Failed to remove resource');
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString();

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Courses</h1>
          <p className="text-muted text-sm mt-1">{courses.length} courses · {totalLessons} lessons</p>
        </div>
        <button
          onClick={openAddCourse}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary-glow transition-colors shadow-glow-primary-sm"
        >
          <Plus className="w-4 h-4" /> Add course
        </button>
      </div>

      <div className="bg-surface rounded-card border border-border overflow-hidden shadow-card mb-8">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surfaceElevated">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Preview</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Lessons</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-surfaceElevated/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="w-14 h-10 rounded-lg bg-surfaceElevated overflow-hidden shrink-0">
                      {c.image_url ? (
                        <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-muted" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-foreground">{c.title}</td>
                  <td className="px-6 py-4 text-muted">{c.lesson_count ?? 0}</td>
                  <td className="px-6 py-4 text-muted text-sm">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openManageLessons(c)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surfaceElevated hover:bg-surface/80 text-foreground text-sm font-medium transition-colors">
                        <ListVideo className="w-3.5 h-3.5" /> Lessons
                      </button>
                      <button onClick={() => openEditCourse(c)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium transition-colors">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => deleteCourse(c.id, c.title)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {courses.length === 0 && (
          <div className="p-12 text-center text-muted">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No courses yet. Click &quot;Add course&quot; to create one.</p>
          </div>
        )}
      </div>

      {lessonsForCourseId != null && (
        <div className="bg-surface rounded-card border border-border p-6 shadow-card mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-foreground">Lessons for {lessonsForCourseTitle}</h2>
            <div className="flex items-center gap-2">
              <button onClick={openAddLesson} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary-glow transition-colors">
                <Plus className="w-4 h-4" /> Add lesson
              </button>
              <button onClick={() => setLessonsForCourseId(null)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surfaceElevated hover:bg-surface/80 text-foreground text-sm font-medium transition-colors">
                <X className="w-4 h-4" /> Close
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surfaceElevated">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">#</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">Title</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted uppercase tracking-wider">Video</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lessons.map((l) => (
                  <tr key={l.id} className="hover:bg-surfaceElevated/50 transition-colors">
                    <td className="px-4 py-3 text-muted font-mono">{l.position}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{l.title}</td>
                    <td className="px-4 py-3 text-muted text-sm truncate max-w-[220px]" title={l.video_url}>
                      {l.video_type}: {l.video_url.length > 50 ? l.video_url.slice(0, 50) + '…' : l.video_url}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEditLesson(l)} className="text-primary hover:underline text-sm font-medium mr-3">Edit</button>
                      <button onClick={() => deleteLesson(l)} className="text-red-400 hover:underline text-sm font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lessons.length === 0 && !showLessonModal && <p className="p-6 text-center text-muted text-sm">No lessons. Click &quot;Add lesson&quot; to add one.</p>}
        </div>
      )}

      {/* Course modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCourseModal(false)}>
          <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-4">{editingCourseId ? 'Edit course' : 'Add course'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Title *</label>
                <input type="text" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="Course title" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Description</label>
                <textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="Optional description" rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Image URL</label>
                <input type="text" value={courseForm.image_url} onChange={(e) => setCourseForm({ ...courseForm, image_url: e.target.value })} placeholder="https://..." className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={saveCourse} className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-black font-bold hover:bg-primary-glow transition-colors">Save</button>
                <button onClick={() => setShowCourseModal(false)} className="px-4 py-2.5 rounded-xl bg-surfaceElevated hover:bg-surface/80 text-foreground font-medium transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lesson modal */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowLessonModal(false)}>
          <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-foreground mb-4">{editingLessonId ? 'Edit lesson' : 'Add lesson'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Title *</label>
                <input type="text" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} placeholder="Lesson title" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Description</label>
                <input type="text" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} placeholder="Optional" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Position</label>
                <input type="number" min={0} value={lessonForm.position} onChange={(e) => setLessonForm({ ...lessonForm, position: parseInt(e.target.value, 10) || 0 })} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Video type *</label>
                <select value={lessonForm.video_type} onChange={(e) => setLessonForm({ ...lessonForm, video_type: e.target.value as 'youtube' | 'wistia' })} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary">
                  <option value="youtube">YouTube</option>
                  <option value="wistia">Wistia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Video URL *</label>
                <input type="url" value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=... or https://fast.wistia.net/embed/iframe/... or https://*.wistia.com/medias/..." className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>

              {editingLessonId != null && (
                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="text-sm font-bold text-foreground mb-3">Lesson Resources</h4>
                  {lessonResources.length > 0 && (
                    <ul className="space-y-2 mb-4">
                      {lessonResources.map((res) => (
                        <li key={res.id} className="flex items-center gap-2 p-2 rounded-lg bg-surfaceElevated border border-border">
                          <span className="flex-1 min-w-0 text-sm text-foreground truncate" title={res.url}>{res.title}</span>
                          <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">Open</a>
                          <button type="button" onClick={() => deleteLessonResource(res.id)} className="p-1 rounded text-red-400 hover:bg-red-500/10 shrink-0" title="Remove">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} placeholder="Title" className="flex-1 min-w-0 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                    <input type="url" value={resourceForm.url} onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })} placeholder="https://..." className="flex-1 min-w-0 bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" />
                    <button type="button" onClick={addLessonResource} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium transition-colors shrink-0">
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={saveLesson} className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-black font-bold hover:bg-primary-glow transition-colors">Save</button>
                <button onClick={() => setShowLessonModal(false)} className="px-4 py-2.5 rounded-xl bg-surfaceElevated hover:bg-surface/80 text-foreground font-medium transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
