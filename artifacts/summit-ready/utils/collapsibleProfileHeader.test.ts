/** Source-shape guards for the You screen's collapsible sticky header. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const account = readFileSync(join(__dirname, "../app/(tabs)/account.tsx"), "utf8");
const presentation = readFileSync(join(__dirname, "../components/profile/PrimaryProfilePresentation.tsx"), "utf8");

describe("collapsible You header", () => {
  it("mounts the hero once and the compact bar outside the ScrollView", () => {
    expect(account.match(/<PrimaryProfilePresentation/g)).toHaveLength(1);
    expect(account.indexOf("<CompactProfileTabsBar")).toBeGreaterThan(account.indexOf("</ScrollView>"));
    expect(account).not.toMatch(/stickyHeaderIndices/);
  });
  it("flips state only at threshold crossings from measured tab position", () => {
    expect(account).toMatch(/collapsedRef\.current === next\) return/);
    expect(account).toMatch(/onTabsLayout=\{\(y\) => \{ tabsY\.current = y; \}\}/);
    expect(account).toMatch(/y - topInsetRef\.current/);
  });
  it("pins below the shell inset and offers back-to-top via the existing ref", () => {
    expect(presentation).toMatch(/\{ top: topInset \}/);
    expect(presentation).toMatch(/accessibilityLabel="Back to top"/);
    expect(account).toMatch(/scrollRef\.current\?\.scrollTo\(\{ y: 0, animated: true \}\)/);
  });
  it("hides the off-screen original tabs from accessibility while collapsed", () => {
    expect(presentation).toMatch(/importantForAccessibility=\{tabsCollapsed \? "no-hide-descendants"/);
    expect(presentation).toMatch(/accessibilityElementsHidden=\{tabsCollapsed\}/);
  });
  it("compact bar does not carry the cover polling", () => {
    const compact = presentation.slice(presentation.indexOf("export function CompactProfileTabsBar"));
    expect(compact).not.toMatch(/setInterval|useFocusEffect/);
  });
});
