import { Banner } from "@/components/ui/Banner";
import { IconChip } from "@/components/ui/IconChip";
import { LogoIcon } from "@/components/ui/icons";

// Placeholder home page. Becomes Sign in (role switcher) in Step 5.
export default function Home() {
  return (
    <>
      <Banner />
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
        <div className="flex items-center gap-3">
          <IconChip color="primary" size={44}>
            <LogoIcon />
          </IconChip>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink">Carebase</h1>
        </div>
        <p className="font-mono text-xs tracking-[0.14em] text-label uppercase">Sign in</p>
      </main>
    </>
  );
}
