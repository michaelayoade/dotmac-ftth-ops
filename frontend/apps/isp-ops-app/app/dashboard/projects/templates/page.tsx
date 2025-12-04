"use client";

/**
 * Template Builder Page
 * Main page for creating and managing project templates
 */

import { useRouter } from "next/navigation";
import { useToast } from "@dotmac/ui";
import { TemplateBuilder } from "@/components/projects/TemplateBuilder";
import type { ProjectTemplate } from "@/types/project-management";

export default function TemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSave = (template: ProjectTemplate) => {
    toast({
      title: "Template created",
      description: `${template.name} is ready to use.`,
    });
    router.push("/dashboard/projects");
  };

  const handleCancel = () => {
    router.push("/dashboard/projects");
  };

  return <TemplateBuilder onSave={handleSave} onCancel={handleCancel} />;
}
