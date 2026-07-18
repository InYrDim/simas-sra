"use server";

import { db } from "@/db";
import { simasApplication } from "@/db/schema";
import {
  createSimasApplicationCommands,
  type SimasApplicationWriter,
} from "@/lib/simas-applications";

export type ApplicationFormState = {
  success: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const applicationWriter: SimasApplicationWriter = {
  async create(application) {
    await db.insert(simasApplication).values(application);
  },
};

export async function submitSimasApplicationAction(
  _previousState: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const commands = createSimasApplicationCommands(applicationWriter);
  const result = await commands.submit({
    schoolName: formData.get("schoolName"),
    npsn: formData.get("npsn"),
    educationLevel: formData.get("educationLevel"),
    address: formData.get("address"),
    contactName: formData.get("contactName"),
    contactPosition: formData.get("contactPosition"),
    contactEmail: formData.get("contactEmail"),
    contactWhatsapp: formData.get("contactWhatsapp"),
    needsNote: formData.get("needsNote"),
  });

  if (!result.ok) {
    return {
      success: false,
      message: "Periksa kembali data pengajuan Anda.",
      errors: result.errors,
    };
  }

  return {
    success: true,
    message: `Pengajuan berhasil dikirim. Nomor pengajuan: ${result.applicationId}`,
  };
}
