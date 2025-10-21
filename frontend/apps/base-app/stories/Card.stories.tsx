import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../components/ui/card";
import { Button } from "../components/ui/button";

const meta = {
  title: "Components/Card",
  component: Card,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card Content</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const Elevated: Story = {
  render: () => (
    <Card variant="elevated" className="w-[350px]">
      <CardHeader>
        <CardTitle>Elevated Card</CardTitle>
        <CardDescription>With shadow</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card has an elevated appearance with a shadow.</p>
      </CardContent>
    </Card>
  ),
};

export const Outline: Story = {
  render: () => (
    <Card variant="outline" className="w-[350px]">
      <CardHeader>
        <CardTitle>Outline Card</CardTitle>
        <CardDescription>With thicker border</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card has a more prominent outline.</p>
      </CardContent>
    </Card>
  ),
};

export const Ghost: Story = {
  render: () => (
    <Card variant="ghost" className="w-[350px]">
      <CardHeader>
        <CardTitle>Ghost Card</CardTitle>
        <CardDescription>Transparent background</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card has a transparent background.</p>
      </CardContent>
    </Card>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Card className="w-[300px]">
        <CardHeader>
          <CardTitle>Default</CardTitle>
          <CardDescription>Standard card</CardDescription>
        </CardHeader>
        <CardContent>Content here</CardContent>
      </Card>
      <Card variant="elevated" className="w-[300px]">
        <CardHeader>
          <CardTitle>Elevated</CardTitle>
          <CardDescription>With shadow</CardDescription>
        </CardHeader>
        <CardContent>Content here</CardContent>
      </Card>
      <Card variant="outline" className="w-[300px]">
        <CardHeader>
          <CardTitle>Outline</CardTitle>
          <CardDescription>Thick border</CardDescription>
        </CardHeader>
        <CardContent>Content here</CardContent>
      </Card>
      <Card variant="ghost" className="w-[300px]">
        <CardHeader>
          <CardTitle>Ghost</CardTitle>
          <CardDescription>Transparent</CardDescription>
        </CardHeader>
        <CardContent>Content here</CardContent>
      </Card>
    </div>
  ),
};
