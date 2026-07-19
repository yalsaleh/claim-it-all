'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addProjectMember, createProject, updateProject } from '@/server/services/projects';
import { AppError } from '@/server/errors';

export type ProjectActionState = {
  error?: string;
  success?: string;
};

export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    const project = await createProject({
      name: String(formData.get('name') ?? ''),
      code: String(formData.get('code') ?? '').toUpperCase(),
      description: String(formData.get('description') ?? '') || undefined,
      countryCode: String(formData.get('countryCode') ?? '').toUpperCase(),
      defaultCurrency: String(formData.get('defaultCurrency') ?? '').toUpperCase(),
      timezone: String(formData.get('timezone') ?? ''),
      status: 'ACTIVE',
    });
    revalidatePath('/projects');
    redirect(`/projects/${project.id}`);
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    // Next.js redirect throws; rethrow it.
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    return { error: 'Unable to create project.' };
  }
}

export async function updateProjectAction(
  projectId: string,
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    const status = String(formData.get('status') ?? '');
    await updateProject(projectId, {
      name: String(formData.get('name') ?? '') || undefined,
      description: String(formData.get('description') ?? '') || undefined,
      status: status || undefined,
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/projects');
    return { success: 'Project updated.' };
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: 'Unable to update project.' };
  }
}

export async function addProjectMemberAction(
  projectId: string,
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  try {
    await addProjectMember(projectId, {
      userId: String(formData.get('userId') ?? ''),
      role: String(formData.get('role') ?? ''),
    });
    revalidatePath(`/projects/${projectId}`);
    return { success: 'Member added.' };
  } catch (error) {
    if (error instanceof AppError) {
      return { error: error.message };
    }
    return { error: 'Unable to add project member.' };
  }
}
