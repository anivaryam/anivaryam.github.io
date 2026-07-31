import { Component, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImageCombinerTool } from "@/components/tools/ImageCombinerTool";
import type { ExtractedImage } from "@/lib/image-extractor/extractor";

interface ImageCombinerModalProps {
  groupId: string;
  images: ExtractedImage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

class CombinerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Image Combiner encountered an error. Close this dialog and try again.
        </div>
      );
    }
    return this.props.children;
  }
}

function extImageToFile(img: ExtractedImage): File | null {
  if (!img.blob) return null;
  return new File([img.blob], img.filename, { type: img.blob.type || "image/png" });
}

export function ImageCombinerModal({
  groupId,
  images,
  open,
  onOpenChange,
}: ImageCombinerModalProps) {
  const initialFiles = images
    .map(extImageToFile)
    .filter((f): f is File => f !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        data-lenis-prevent
      >
        <DialogHeader>
          <DialogTitle>Combine Images</DialogTitle>
          <DialogDescription>
            {initialFiles.length} image{initialFiles.length === 1 ? "" : "s"} from group {groupId} — arrange and combine.
          </DialogDescription>
        </DialogHeader>
        <CombinerErrorBoundary>
          <ImageCombinerTool initialFiles={initialFiles} />
        </CombinerErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
