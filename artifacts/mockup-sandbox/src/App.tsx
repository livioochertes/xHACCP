import { useEffect, useState, type ComponentType } from 'react';

import { modules as discoveredModules } from './.generated/mockup-components';

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

function _resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const fns = Object.values(mod).filter(
    (v) => typeof v === 'function',
  ) as ComponentType[];
  return (
    (mod.default as ComponentType) ||
    (mod.Preview as ComponentType) ||
    (mod[name] as ComponentType) ||
    fns[fns.length - 1]
  );
}

function PreviewRenderer({
  componentPath,
  modules,
}: {
  componentPath: string;
  modules: ModuleMap;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setComponent(null);
    setError(null);

    async function loadComponent(): Promise<void> {
      const key = `./components/mockups/${componentPath}.tsx`;
      const loader = modules[key];
      if (!loader) {
        setError(`No component found at ${componentPath}.tsx`);
        return;
      }

      try {
        const mod = await loader();
        if (cancelled) {
          return;
        }
        const name = componentPath.split('/').pop()!;
        const comp = _resolveComponent(mod, name);
        if (!comp) {
          setError(
            `No exported React component found in ${componentPath}.tsx\n\nMake sure the file has at least one exported function component.`,
          );
          return;
        }
        setComponent(() => comp);
      } catch (e) {
        if (cancelled) {
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
        setError(`Failed to load preview.\n${message}`);
      }
    }

    void loadComponent();

    return () => {
      cancelled = true;
    };
  }, [componentPath, modules]);

  if (error) {
    return (
      <pre style={{ color: 'red', padding: '2rem', fontFamily: 'system-ui' }}>
        {error}
      </pre>
    );
  }

  if (!Component) return null;

  return <Component />;
}

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '');
}

function getPreviewExamplePath(): string {
  const basePath = getBasePath();
  return `${basePath}/preview/ComponentName`;
}

function Gallery() {
  const basePath = getBasePath();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Component Preview Server
        </h1>
        <p className="text-gray-500 mb-4">
          This server renders individual components for the workspace canvas.
        </p>
        <p className="text-sm text-gray-400">
          Access component previews at{' '}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {getPreviewExamplePath()}
          </code>
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
            href={`${basePath}/exports/chef-event-qr-card.png`}
            download
          >
            Télécharger PNG · 1920×1080
          </a>
          <a
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            href={`${basePath}/exports/chef-event-qr-card.pdf`}
            download
          >
            Télécharger PDF · 16:9
          </a>
          <a
            className="rounded-lg border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-medium text-cyan-800 shadow-sm transition hover:bg-cyan-100"
            href={`${basePath}/exports/chef-event-qr-card.html`}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir le card cliquable
          </a>
          <a
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700"
            href={`https://wa.me/?text=${encodeURIComponent("Offre Chef Event : https://xhaccp.fr/chef-event")}`}
            target="_blank"
            rel="noreferrer"
          >
            Partager sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function getPreviewPath(): string | null {
  const basePath = getBasePath();
  const { pathname } = window.location;
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || '/'
      : pathname;
  const match = local.match(/^\/preview\/(.+)$/);
  return match ? match[1] : null;
}

function App() {
  const previewPath = getPreviewPath();

  if (previewPath) {
    return (
      <PreviewRenderer
        componentPath={previewPath}
        modules={discoveredModules}
      />
    );
  }

  return <Gallery />;
}

export default App;
