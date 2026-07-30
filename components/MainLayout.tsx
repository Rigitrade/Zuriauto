import Header from "@/components/Header";
import Footer from "@/components/NewFooter";

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
