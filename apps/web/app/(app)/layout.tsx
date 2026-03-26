import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { CaptureProvider } from "@/components/providers/capture-provider";
import { getToken } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getToken();

  return (
    <ConvexClientProvider initialToken={token}>
      <CaptureProvider>
        <div className="min-h-screen">{children}</div>
      </CaptureProvider>
    </ConvexClientProvider>
  );
}
