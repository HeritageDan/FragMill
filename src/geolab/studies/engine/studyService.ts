import { db, getOrganisationProfile } from '../../../db';
import type {
  StudyReport,
  StudyRevision,
  StudyPhoto,
  StudySection,
} from '../../../types/geolab';
import { getStudyTemplate } from '../templates';
import { compressStudyPhoto } from './photoUtils';

export interface CreateStudyReportParams {
  projectId: string;
  templateId: string;
  title: string;
  language: 'en' | 'fr';
  includedAnalysisIds: string[];
  reportNumber?: string;
  authorName?: string;
}

export async function createStudyReport(params: CreateStudyReportParams): Promise<StudyReport> {
  const { projectId, templateId, title, language, includedAnalysisIds, authorName } = params;

  const template = getStudyTemplate(templateId) || getStudyTemplate('characterisation_soils');
  const sections: StudySection[] = template
    ? template.sections.map((s, idx) => ({
        ...s,
        id: `sec-${idx + 1}`,
      }))
    : [];

  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];

  // Auto-generate report number if not provided
  let reportNumber = params.reportNumber;
  if (!reportNumber) {
    const existingCount = await db.studyReports.count();
    reportNumber = `ETD-${new Date().getFullYear()}-${String(existingCount + 1).padStart(3, '0')}`;
  }

  const initialRevision: StudyRevision = {
    index: 0,
    date: dateStr,
    nature: language === 'fr' ? 'Édition originale' : 'Initial issue',
    preparedBy: authorName || '',
    checkedBy: '',
    approvedBy: '',
  };

  const newStudy: StudyReport = {
    id: `study-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    projectId,
    templateId,
    title,
    language,
    status: 'draft',
    reportNumber,
    revisions: [initialRevision],
    sections,
    includedAnalysisIds,
    createdAt: now,
    updatedAt: now,
  };

  await db.studyReports.put(newStudy);
  return newStudy;
}

export async function createNewStudyRevision(
  studyId: string,
  natureOfChange: string,
  authorName?: string,
  language: 'en' | 'fr' = 'en'
): Promise<StudyReport> {
  if (!natureOfChange || !natureOfChange.trim()) {
    throw new Error(
      language === 'fr'
        ? 'La nature de la modification est obligatoire pour créer une révision.'
        : 'Nature of change is required to create a new revision.'
    );
  }

  const study = await db.studyReports.get(studyId);
  if (!study) throw new Error('Study not found');

  // Deep snapshot of current study state
  const snapshot = {
    title: study.title,
    sections: JSON.parse(JSON.stringify(study.sections)),
    includedAnalysisIds: [...study.includedAnalysisIds],
    status: study.status,
    reportNumber: study.reportNumber,
  };

  const lastIndex = study.revisions && study.revisions.length > 0
    ? Math.max(...study.revisions.map((r) => r.index))
    : 0;

  const nextIndex = lastIndex + 1;
  const dateStr = new Date().toISOString().split('T')[0];

  const newRevision: StudyRevision = {
    index: nextIndex,
    date: dateStr,
    nature: natureOfChange.trim(),
    preparedBy: authorName || '',
    checkedBy: '',
    approvedBy: '',
    snapshot,
  };

  const updatedStudy: StudyReport = {
    ...study,
    status: 'draft', // creating a new revision sets status back to draft for editing
    revisions: [...(study.revisions || []), newRevision],
    updatedAt: new Date().toISOString(),
  };

  await db.studyReports.put(updatedStudy);
  return updatedStudy;
}

export async function updateStudyReport(
  studyId: string,
  updates: Partial<StudyReport>,
  language: 'en' | 'fr' = 'en'
): Promise<StudyReport> {
  const study = await db.studyReports.get(studyId);
  if (!study) throw new Error('Study not found');

  // Rule 13: Approved studies are locked; editing requires a new revision
  if (study.status === 'approved') {
    const isOnlyStatusUpdate =
      Object.keys(updates).length === 1 && 'status' in updates;

    if (!isOnlyStatusUpdate) {
      throw new Error(
        language === 'fr'
          ? 'Cette étude est approuvée et verrouillée. Veuillez créer un nouvel indice de révision pour la modifier.'
          : 'This study is approved and locked. Please create a new revision to edit.'
      );
    }
  }

  const merged: StudyReport = {
    ...study,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await db.studyReports.put(merged);
  return merged;
}

export async function changeStudyStatus(
  studyId: string,
  newStatus: 'draft' | 'checked' | 'approved',
  language: 'en' | 'fr' = 'en'
): Promise<StudyReport> {
  const study = await db.studyReports.get(studyId);
  if (!study) throw new Error('Study not found');

  // Enforce company name requirement if approving
  if (newStatus === 'approved') {
    const org = await getOrganisationProfile();
    if (!org.companyName?.trim()) {
      throw new Error(
        language === 'fr'
          ? 'Veuillez configurer le profil de votre organisation avant d’approuver une étude.'
          : 'Please configure your organisation profile before approving a study.'
      );
    }
  }

  const updated: StudyReport = {
    ...study,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  await db.studyReports.put(updated);
  return updated;
}

export async function addStudyPhoto(
  studyId: string,
  fileOrBlob: Blob | File | string,
  caption = ''
): Promise<StudyPhoto> {
  const compressed = await compressStudyPhoto(fileOrBlob);

  const existingPhotos = await db.studyPhotos.where('studyId').equals(studyId).toArray();
  const nextOrder = existingPhotos.length + 1;

  const photo: StudyPhoto = {
    id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    studyId,
    order: nextOrder,
    caption,
    mimeType: compressed.mimeType,
    blob: compressed.base64,
  };

  await db.studyPhotos.put(photo);
  return photo;
}

export async function deleteStudyPhoto(photoId: string): Promise<void> {
  await db.studyPhotos.delete(photoId);
}

export async function updateStudyPhotoCaption(photoId: string, caption: string): Promise<void> {
  const p = await db.studyPhotos.get(photoId);
  if (p) {
    p.caption = caption;
    await db.studyPhotos.put(p);
  }
}

export async function reorderStudyPhotos(studyId: string, orderedPhotoIds: string[]): Promise<void> {
  for (let i = 0; i < orderedPhotoIds.length; i++) {
    const id = orderedPhotoIds[i];
    const p = await db.studyPhotos.get(id);
    if (p && p.studyId === studyId) {
      p.order = i + 1;
      await db.studyPhotos.put(p);
    }
  }
}
