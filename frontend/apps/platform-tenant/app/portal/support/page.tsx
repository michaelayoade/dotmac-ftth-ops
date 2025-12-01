"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/primitives";
import { LifeBuoy, Mail, MessageCircle, Book, ExternalLink } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support</h1>
        <p className="text-muted-foreground">
          Get help and access support resources
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Support
            </CardTitle>
            <CardDescription>
              Contact our support team via email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              For billing inquiries, technical issues, or general questions.
              Response time: within 24 hours.
            </p>
            <Button asChild variant="secondary" className="w-full">
              <a href="mailto:support@dotmac.io">
                <Mail className="h-4 w-4 mr-2" />
                support@dotmac.io
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Live Chat
            </CardTitle>
            <CardDescription>
              Chat with our support team in real-time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Available Monday to Friday, 9 AM - 6 PM EST. For urgent issues
              outside these hours, use email.
            </p>
            <Button className="w-full">
              <MessageCircle className="h-4 w-4 mr-2" />
              Start Chat
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              Documentation
            </CardTitle>
            <CardDescription>
              Browse our knowledge base and guides
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Find answers to common questions, setup guides, and best
              practices.
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href="https://docs.dotmac.io" target="_blank" rel="noopener">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Documentation
              </a>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5" />
              Emergency Support
            </CardTitle>
            <CardDescription>
              For critical production issues only
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              24/7 emergency hotline for Enterprise plan customers with
              critical outages.
            </p>
            <Button variant="destructive" className="w-full">
              <LifeBuoy className="h-4 w-4 mr-2" />
              Emergency Line
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
