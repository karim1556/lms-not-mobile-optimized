"use client"

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LessonDetails {
  id: string;
  title: string;
  duration: string;
  type: string;
  content: string;
  is_preview: boolean;
  section_id: string;
}

interface AddLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newLesson: any) => void;
  onEdit: (updatedLesson: any) => void;
  lessonToEdit: LessonDetails | null;
  sections: { id: string; title: string }[];
  courseTitle: string;
}

const lessonTypes = [
  { id: 'youtube', label: 'YouTube Video' },
  { id: 'vimeo', label: 'Vimeo Video' },
  { id: 'video_file', label: 'Video file' },
  { id: 'video_url', label: 'Video url [.mp4]' },
  { id: 'document', label: 'Document' },
  { id: 'image', label: 'Image file' },
  { id: 'iframe', label: 'Iframe embed' },
];

export function AddLessonModal({ isOpen, onClose, onAdd, onEdit, lessonToEdit, sections, courseTitle }: AddLessonModalProps) {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [selectedSection, setSelectedSection] = useState('');
  const [lessonType, setLessonType] = useState('youtube');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [content, setContent] = useState(''); // For URLs or iframe code
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  const isEditMode = lessonToEdit !== null;

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && lessonToEdit) {
        // Pre-fill form for editing
        setTitle(lessonToEdit.title);
        setDuration(lessonToEdit.duration);
        setLessonType(lessonToEdit.type);
        setContent(lessonToEdit.content || '');
        setIsPreview(lessonToEdit.is_preview);
        setSelectedSection(lessonToEdit.section_id);
        // Skip to step 2 in edit mode
        setStep(2);
      } else {
        // Reset form for adding
        resetForm();
      }
    }
  }, [lessonToEdit, isOpen]);

  // If user selects Vimeo and pastes a Vimeo URL, convert it to the external
  // player embed URL. This is a simple heuristic that takes the last path
  // segment of the provided Vimeo link and appends it to the player embed path.
  // If the content already looks like the embed URL, do nothing.
  useEffect(() => {
    try {
      if (lessonType !== 'vimeo' || !content) return;

      const alreadyEmbed = /\/api\/videos\/embed\//i.test(content) || /api\.aiskool\.com/i.test(content) || content.includes('216.48.182.5');
      if (alreadyEmbed) return;

      // Detect common Vimeo URL patterns and extract the id (last path segment)
      const vimeoMatch = content.match(/vimeo\.com\/(?:video\/)?([0-9a-zA-Z\-_.]+)/i);
        if (vimeoMatch && vimeoMatch[1]) {
        const videoId = vimeoMatch[1];
        const embedUrl = `https://api.aiskool.com/api/videos/embed/${videoId}`;
        setContent(embedUrl);
      }
    } catch (e) {
      // ignore parsing failures
      console.error('Error converting Vimeo URL to embed:', e);
    }
  }, [content, lessonType]);

  const resetForm = () => {
    setStep(1);
    setIsLoading(false);
    setSelectedSection('');
    setLessonType('youtube');
    setTitle('');
    setDuration('');
    setContent('');
    setAttachment(null);
    setIsPreview(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  }

  const handleSave = async () => {
    if (!title || !selectedSection || !duration) {
      toast.error('Title, Section, and Duration are required.');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('duration', duration);
      formData.append('content', content || '');
      formData.append('is_preview', String(isPreview));
      formData.append('type', lessonType);
      formData.append('section_id', selectedSection);
      
      // Only append file if it exists and is a file upload type
      if (attachment && ['video_file', 'document', 'image'].includes(lessonType)) {
        formData.append('file', attachment);
      }

      // For local development, automatically request local storage so devs don't need Supabase
      try {
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
          formData.append('use_local', '1')
        }
      } catch (e) {
        // ignore
      }

      const url = isEditMode ? `/api/lessons/${lessonToEdit.id}` : `/api/sections/${selectedSection}/lessons`;
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create lesson';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      toast.success(`Lesson ${isEditMode ? 'updated' : 'added'} successfully!`);
      if (isEditMode) {
        onEdit(result);
      } else {
        onAdd(result);
      }
      handleClose();

    } catch (error) {
      console.error('Error in handleSave:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep2 = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="section" className="text-right">Section</Label>
        <Select onValueChange={setSelectedSection} value={selectedSection}>
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="Select a section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((section) => (
              <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="title" className="text-right">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" />
      </div>
      {['youtube', 'vimeo', 'video_url'].includes(lessonType) && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="url" className="text-right">URL</Label>
          <Input id="url" value={content} onChange={(e) => setContent(e.target.value)} className="col-span-3" placeholder={`Enter ${lessonType.replace('_', ' ')} URL`} />
        </div>
      )}
      {['video_file', 'document', 'image'].includes(lessonType) && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="attachment" className="text-right">File</Label>
          <Input id="attachment" type="file" onChange={(e) => setAttachment(e.target.files ? e.target.files[0] : null)} className="col-span-3" />
        </div>
      )}
      {lessonType === 'iframe' && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="iframe" className="text-right">Iframe Code</Label>
          <Input id="iframe" value={content} onChange={(e) => setContent(e.target.value)} className="col-span-3" placeholder='Paste your iframe embed code here' />
        </div>
      )}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="duration" className="text-right">Duration</Label>
        <Input id="duration" value={duration} onChange={(e) => setDuration(e.target.value)} className="col-span-3" placeholder="e.g., 10:30 or 5m" />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="is_preview" className="text-right">Allow Preview?</Label>
        <Checkbox id="is_preview" checked={isPreview} onCheckedChange={(checked) => setIsPreview(Boolean(checked))} />
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Lesson' : 'Add New Lesson'}</DialogTitle>
        </DialogHeader>
        {step === 1 ? (
          <div className='space-y-4'>
             <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">Course: <strong>{courseTitle}</strong></p>
            </div>
            <Label>Select lesson type</Label>
            <RadioGroup value={lessonType} onValueChange={setLessonType}>
                {lessonTypes.map(type => (
                    <div key={type.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                        <RadioGroupItem value={type.id} id={type.id} />
                        <Label htmlFor={type.id} className='font-normal w-full cursor-pointer'>{type.label}</Label>
                    </div>
                ))}
            </RadioGroup>
          </div>
        ) : renderStep2()}
        <DialogFooter>
          {step === 1 && !isEditMode ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => setStep(2)}>Next</Button>
            </>
          ) : (
            <>
              {!isEditMode && <Button variant="outline" onClick={() => setStep(1)}>Back</Button>}
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Lesson')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
