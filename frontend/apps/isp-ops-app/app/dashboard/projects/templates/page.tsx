"use client";

/**
 * Template Builder Page
 * Main page for creating and managing project templates
 */

import { useRouter } from "next/navigation";
import { TemplateBuilder } from "@/components/projects/TemplateBuilder";
import type { ProjectTemplate } from "@/types/project-management";

export default function TemplatesPage() {
  const router = useRouter();

  const handleSave = (template: ProjectTemplate) => {
    console.log("Template saved:", template);
    router.push("/dashboard/projects");
  };

  const handleCancel = () => {
    router.push("/dashboard/projects");
  };

  return (
    <TemplateBuilder
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
