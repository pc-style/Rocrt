import { render } from 'preact';
import { useState } from 'preact/hooks';

export interface ProjectMeta {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string | null;
  createdAt: number;
  modifiedAt: number;
  layerCount: number;
}

interface GalleryProps {
  projects: ProjectMeta[];
  onOpenProject: (id: string) => void;
  onCreateProject: (width: number, height: number, name?: string) => void;
  onDeleteProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onImportProject: (data: unknown) => void;
}

// procreate-style dark theme colors
const colors = {
  bg: '#1c1c1e',
  surface: '#2c2c2e',
  surfaceHover: '#3a3a3c',
  accent: '#0a84ff',
  text: '#ffffff',
  textSecondary: '#8e8e93',
  border: '#3a3a3c',
  danger: '#ff453a',
};

function ProjectCard({
  project,
  onOpen,
  onDelete,
  onDuplicate,
  onRename,
}: {
  project: ProjectMeta;
  onOpen: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRename: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const formattedDate = new Date(project.modifiedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      style={{
        position: 'relative',
        width: '200px',
        background: colors.surface,
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        setShowMenu(false);
      }}
    >
      {/* thumbnail */}
      <div
        onClick={onOpen}
        style={{
          width: '100%',
          height: '150px',
          background: project.thumbnail
            ? `url(${project.thumbnail}) center/cover`
            : `linear-gradient(135deg, #3a3a3c 0%, #2c2c2e 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!project.thumbnail && (
          <span style={{ color: colors.textSecondary, fontSize: '32px' }}>+</span>
        )}
      </div>

      {/* info bar */}
      <div style={{ padding: '12px' }}>
        <div
          style={{
            color: colors.text,
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
        </div>
        <div
          style={{
            color: colors.textSecondary,
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{project.width} x {project.height}</span>
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '28px',
          height: '28px',
          borderRadius: '14px',
          border: 'none',
          background: 'rgba(0,0,0,0.5)',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ...
      </button>

      {/* dropdown menu */}
      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '8px',
            background: colors.surface,
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRename();
              setShowMenu(false);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              color: colors.text,
              fontSize: '14px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Rename
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
              setShowMenu(false);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              color: colors.text,
              fontSize: '14px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Duplicate
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this project?')) {
                onDelete();
              }
              setShowMenu(false);
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              border: 'none',
              background: 'transparent',
              color: colors.danger,
              fontSize: '14px',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NewProjectCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      onClick={onCreate}
      style={{
        width: '200px',
        height: '214px',
        background: colors.surface,
        borderRadius: '12px',
        border: `2px dashed ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = colors.accent;
        (e.currentTarget as HTMLElement).style.background = colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = colors.border;
        (e.currentTarget as HTMLElement).style.background = colors.surface;
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '24px',
          background: colors.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
        }}
      >
        <span style={{ color: '#fff', fontSize: '28px', fontWeight: '300' }}>+</span>
      </div>
      <span style={{ color: colors.text, fontSize: '14px' }}>New Canvas</span>
    </div>
  );
}

function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (width: number, height: number, name: string) => void;
}) {
  const [name, setName] = useState('Untitled');
  const [width, setWidth] = useState(2048);
  const [height, setHeight] = useState(2048);

  const presets = [
    { label: 'Square', w: 2048, h: 2048 },
    { label: 'Screen', w: 1920, h: 1080 },
    { label: 'Portrait', w: 1080, h: 1920 },
    { label: '4K', w: 3840, h: 2160 },
    { label: 'iPad', w: 2048, h: 2732 },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '400px',
          background: colors.surface,
          borderRadius: '16px',
          padding: '24px',
        }}
      >
        <h2 style={{ color: colors.text, fontSize: '20px', margin: '0 0 20px 0' }}>
          New Canvas
        </h2>

        {/* name input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px' }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.text,
              fontSize: '14px',
            }}
          />
        </div>

        {/* presets */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '8px' }}>
            Presets
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  setWidth(p.w);
                  setHeight(p.h);
                }}
                style={{
                  padding: '6px 12px',
                  background: width === p.w && height === p.h ? colors.accent : colors.bg,
                  border: 'none',
                  borderRadius: '6px',
                  color: colors.text,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* dimensions */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px' }}>
              Width
            </label>
            <input
              type="number"
              value={width}
              min={1}
              max={8192}
              onInput={(e) => setWidth(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '14px',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ color: colors.textSecondary, fontSize: '12px', display: 'block', marginBottom: '6px' }}>
              Height
            </label>
            <input
              type="number"
              value={height}
              min={1}
              max={8192}
              onInput={(e) => setHeight(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              background: colors.bg,
              border: 'none',
              borderRadius: '8px',
              color: colors.text,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(width, height, name || 'Untitled')}
            style={{
              padding: '10px 24px',
              background: colors.accent,
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export function Gallery({
  projects,
  onOpenProject,
  onCreateProject,
  onDeleteProject,
  onDuplicateProject,
  onRenameProject,
  onImportProject,
}: GalleryProps) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === 'date') return b.modifiedAt - a.modifiedAt;
    return a.name.localeCompare(b.name);
  });

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        onImportProject(data);
      } catch (err) {
        console.error('Failed to import:', err);
      }
    };
    input.click();
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: colors.bg,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* header */}
      <header
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <h1 style={{ color: colors.text, fontSize: '24px', fontWeight: '600', margin: 0 }}>
          Gallery
        </h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as 'date' | 'name')}
            style={{
              padding: '8px 12px',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              color: colors.text,
              fontSize: '13px',
            }}
          >
            <option value="date">Recent</option>
            <option value="name">Name</option>
          </select>
          <button
            onClick={handleImport}
            style={{
              padding: '8px 16px',
              background: colors.surface,
              border: 'none',
              borderRadius: '8px',
              color: colors.text,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Import
          </button>
        </div>
      </header>

      {/* project grid */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <NewProjectCard onCreate={() => setShowNewModal(true)} />
          {sortedProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => onOpenProject(project.id)}
              onDelete={() => onDeleteProject(project.id)}
              onDuplicate={() => onDuplicateProject(project.id)}
              onRename={() => {
                const newName = prompt('Rename project:', project.name);
                if (newName && newName.trim()) {
                  onRenameProject(project.id, newName.trim());
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* new project modal */}
      {showNewModal && (
        <NewProjectModal
          onClose={() => setShowNewModal(false)}
          onCreate={(w, h, n) => {
            onCreateProject(w, h, n);
            setShowNewModal(false);
          }}
        />
      )}
    </div>
  );
}

export function mountGallery(
  container: HTMLElement,
  props: GalleryProps
) {
  render(<Gallery {...props} />, container);
}
