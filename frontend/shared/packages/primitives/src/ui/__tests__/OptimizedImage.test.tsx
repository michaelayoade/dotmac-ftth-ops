/**
 * OptimizedImage component tests
 * Testing image optimization and fallback behavior
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import React from "react";

import { OptimizedImage } from "../OptimizedImage";

describe("OptimizedImage Component", () => {
  const defaultProps = {
    src: "/test-image.jpg",
    alt: "Test image description",
  };

  describe("Basic Rendering", () => {
    it("renders image with required props", () => {
      render(<OptimizedImage {...defaultProps} />);

      const image = screen.getByRole("img", {
        name: /test image description/i,
      });
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "/test-image.jpg");
      expect(image).toHaveAttribute("alt", "Test image description");
    });

    it("renders as img element", () => {
      render(<OptimizedImage {...defaultProps} />);

      const image = screen.getByRole("img");
      expect(image.tagName).toBe("IMG");
    });

    it("applies custom className", () => {
      render(<OptimizedImage {...defaultProps} className="custom-image" />);

      const image = screen.getByRole("img");
      expect(image).toHaveClass("custom-image");
    });

    it("forwards ref correctly", () => {
      const ref = React.createRef<HTMLImageElement>();
      render(<OptimizedImage {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLImageElement);
      expect(ref.current).toHaveAttribute("src", "/test-image.jpg");
    });
  });

  describe("Optimization Props", () => {
    it("applies width and height attributes", () => {
      render(<OptimizedImage {...defaultProps} width={300} height={200} />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("width", "300");
      expect(image).toHaveAttribute("height", "200");
    });

    it("sets loading to eager when priority is true", () => {
      render(<OptimizedImage {...defaultProps} priority />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("loading", "eager");
    });

    it("sets loading to lazy by default", () => {
      render(<OptimizedImage {...defaultProps} />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("loading", "lazy");
    });

    it("sets decoding to async", () => {
      render(<OptimizedImage {...defaultProps} />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("decoding", "async");
    });

    it("handles quality prop (passes through)", () => {
      render(<OptimizedImage {...defaultProps} quality={90} data-quality="90" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("data-quality", "90");
    });

    it("handles placeholder prop (passes through)", () => {
      render(<OptimizedImage {...defaultProps} placeholder="blur" data-placeholder="blur" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("data-placeholder", "blur");
    });
  });

  describe("Event Handling", () => {
    it("handles onLoad event", () => {
      const handleLoad = jest.fn();
      render(<OptimizedImage {...defaultProps} onLoad={handleLoad} />);

      const image = screen.getByRole("img");
      fireEvent.load(image);

      expect(handleLoad).toHaveBeenCalledTimes(1);
    });

    it("handles onError event", () => {
      const handleError = jest.fn();
      render(<OptimizedImage {...defaultProps} onError={handleError} />);

      const image = screen.getByRole("img");
      fireEvent.error(image);

      expect(handleError).toHaveBeenCalledTimes(1);
    });

    it("handles onLoadStart event", () => {
      const handleLoadStart = jest.fn();
      render(<OptimizedImage {...defaultProps} onLoadStart={handleLoadStart} />);

      const image = screen.getByRole("img");
      fireEvent.loadStart(image);

      expect(handleLoadStart).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility", () => {
    it("should be accessible", async () => {
      const { container } = render(<OptimizedImage {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("requires alt text", () => {
      render(<OptimizedImage src="/test.jpg" alt="Required alt text" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("alt", "Required alt text");
    });

    it("supports decorative images with empty alt", () => {
      render(<OptimizedImage src="/decorative.jpg" alt="" />);

      const image = screen.getByRole("img", { hidden: true });
      expect(image).toHaveAttribute("alt", "");
    });

    it("supports additional ARIA attributes", () => {
      render(<OptimizedImage {...defaultProps} aria-describedby="image-description" role="img" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("aria-describedby", "image-description");
    });
  });

  describe("Different Image Sources", () => {
    it("handles relative paths", () => {
      render(<OptimizedImage src="./relative-image.jpg" alt="Relative path" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("src", "./relative-image.jpg");
    });

    it("handles absolute URLs", () => {
      render(<OptimizedImage src="https://example.com/image.jpg" alt="External image" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("src", "https://example.com/image.jpg");
    });

    it("handles data URLs", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      render(<OptimizedImage src={dataUrl} alt="Data URL image" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("src", dataUrl);
    });
  });

  describe("Performance Attributes", () => {
    it("applies fetchpriority for priority images", () => {
      render(<OptimizedImage {...defaultProps} priority fetchPriority="high" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("fetchpriority", "high");
    });

    it("supports srcset for responsive images", () => {
      const srcSet = "/image-320.jpg 320w, /image-640.jpg 640w, /image-1280.jpg 1280w";
      render(<OptimizedImage {...defaultProps} srcSet={srcSet} />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("srcset", srcSet);
    });

    it("supports sizes attribute", () => {
      render(<OptimizedImage {...defaultProps} sizes="(max-width: 768px) 100vw, 50vw" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("sizes", "(max-width: 768px) 100vw, 50vw");
    });
  });

  describe("Error States", () => {
    it("maintains image element even on error", () => {
      render(<OptimizedImage {...defaultProps} />);

      const image = screen.getByRole("img");
      fireEvent.error(image);

      expect(image).toBeInTheDocument();
    });

    it("handles missing src gracefully", () => {
      // TypeScript would prevent this, but testing runtime behavior
      render(<OptimizedImage src="" alt="Empty src" />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("src", "");
    });
  });

  describe("Style and Layout", () => {
    it("applies inline styles", () => {
      render(
        <OptimizedImage {...defaultProps} style={{ borderRadius: "8px", objectFit: "cover" }} />,
      );

      const image = screen.getByRole("img");
      expect(image).toHaveStyle({
        borderRadius: "8px",
        objectFit: "cover",
      });
    });

    it("supports CSS custom properties", () => {
      render(
        <OptimizedImage
          {...defaultProps}
          style={{ "--image-aspect-ratio": "16/9" } as React.CSSProperties}
        />,
      );

      const image = screen.getByRole("img");
      expect(image.style.getPropertyValue("--image-aspect-ratio")).toBe("16/9");
    });
  });

  describe("Loading States", () => {
    it("can be wrapped in loading component", async () => {
      const LoadingWrapper = ({ children }: { children: React.ReactNode }) => {
        const [loaded, setLoaded] = React.useState(false);

        return (
          <div>
            {!loaded && <div data-testid="loading-spinner">Loading...</div>}
            {React.cloneElement(children as React.ReactElement, {
              onLoad: () => setLoaded(true),
            })}
          </div>
        );
      };

      render(
        <LoadingWrapper>
          <OptimizedImage {...defaultProps} />
        </LoadingWrapper>,
      );

      expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();

      const image = screen.getByRole("img");
      fireEvent.load(image);

      await waitFor(() => {
        expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      });
    });
  });

  describe("Integration Patterns", () => {
    it("works within figure element", () => {
      render(
        <figure>
          <OptimizedImage {...defaultProps} />
          <figcaption>Image caption</figcaption>
        </figure>,
      );

      const figure = screen.getByRole("figure");
      const image = screen.getByRole("img");
      const caption = screen.getByText("Image caption");

      expect(figure).toContainElement(image);
      expect(figure).toContainElement(caption);
    });

    it("works with lazy loading intersection observer", () => {
      // Mock IntersectionObserver
      const mockObserve = jest.fn();
      const mockUnobserve = jest.fn();

      global.IntersectionObserver = jest.fn().mockImplementation(() => ({
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: jest.fn(),
      }));

      render(<OptimizedImage {...defaultProps} />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("loading", "lazy");
    });
  });
});
