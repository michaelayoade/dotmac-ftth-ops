import * as UIPackage from "../index";

describe("@dotmac/ui exports", () => {
  it("exposes core components", () => {
    expect(UIPackage).toHaveProperty("Button");
    expect(UIPackage).toHaveProperty("Input");
    expect(UIPackage).toHaveProperty("Card");
    expect(UIPackage).toHaveProperty("Dialog");
    expect(UIPackage).toHaveProperty("Tabs");
  });

  it("exposes advanced data components", () => {
    expect(UIPackage).toHaveProperty("EnhancedDataTable");
    expect(UIPackage).toHaveProperty("DataTable");
    expect(UIPackage).toHaveProperty("DataTableUtils");
  });

  it("exposes utilities and hooks", () => {
    expect(UIPackage).toHaveProperty("cn");
    expect(UIPackage).toHaveProperty("useToast");
    expect(UIPackage).toHaveProperty("toast");
    expect(UIPackage).toHaveProperty("ToastContainer");
    expect(UIPackage).toHaveProperty("ConfirmDialogProvider");
  });

  it("exposes portal theming helpers", () => {
    expect(UIPackage).toHaveProperty("PortalThemeProvider");
    expect(UIPackage).toHaveProperty("usePortalTheme");
    expect(UIPackage).toHaveProperty("portalMetadata");
    expect(UIPackage).toHaveProperty("colorTokens");
    expect(UIPackage).toHaveProperty("detectPortalFromRoute");
  });
});
