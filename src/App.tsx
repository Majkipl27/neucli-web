import React, { useMemo, useState } from 'react';
import yaml from 'js-yaml';
import type { NeucliConfig, NeucliNode, NeucliPage, PageSelection } from './editor/types';
import { createDefaultNode } from './editor/builtInDefaults';
import {
  addBlockToSections,
  addChildBlock,
  addSiblingBlock,
  convertToContainer,
  deleteBlockAtPath,
  getNodeAtPath,
  moveNodeInDirection,
  moveNodeToPosition,
  updateNodeClassName,
  updateNodeLinks,
  updateNodeProp,
  updateNodeText,
} from './editor/treeOps';
import { DEFAULT_CONFIG } from './editor/defaultConfig';
import Toolbar from './editor/Toolbar';
import LeftSidebar from './editor/LeftSidebar';
import Canvas from './editor/Canvas';
import RightPanel from './editor/RightPanel';
import YamlDrawer from './editor/YamlDrawer';

export default function App() {
  const [config, setConfig] = useState<NeucliConfig>(DEFAULT_CONFIG);
  const [pageIndex, setPageIndex] = useState(0);
  const [selection, setSelection] = useState<PageSelection | null>(null);
  const [addType, setAddType] = useState<string>('section');
  const [showYaml, setShowYaml] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const currentPage = config.pages[pageIndex];

  const selectedNode = useMemo(() => {
    if (!selection) return null;
    return getNodeAtPath(config, selection);
  }, [config, selection]);

  const yamlText = useMemo(
    () => yaml.dump(config, { noRefs: true, indent: 2, lineWidth: -1 }),
    [config],
  );

  // ── Page operations ──

  function switchPage(idx: number) {
    setPageIndex(idx);
    setSelection(null);
  }

  function addPage() {
    const idx = config.pages.length;
    const name = `Page ${idx + 1}`;
    const newPage: NeucliPage = {
      path: `/${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      title: name,
      meta: { description: '' },
      sections: [],
    };
    setConfig((prev) => ({ ...prev, pages: [...prev.pages, newPage] }));
    setPageIndex(idx);
    setSelection(null);
  }

  function deletePage(idx: number) {
    if (config.pages.length <= 1) return;
    setConfig((prev) => ({ ...prev, pages: prev.pages.filter((_, i) => i !== idx) }));
    if (pageIndex >= config.pages.length - 1) {
      setPageIndex(Math.max(0, config.pages.length - 2));
    } else if (idx < pageIndex) {
      setPageIndex((p) => p - 1);
    }
    setSelection(null);
  }

  function updatePage(idx: number, updates: Partial<NeucliPage>) {
    setConfig((prev) => {
      const pages = [...prev.pages];
      pages[idx] = { ...pages[idx], ...updates };
      return { ...prev, pages };
    });
  }

  function duplicatePage(idx: number) {
    const source = config.pages[idx];
    const copy: NeucliPage = JSON.parse(JSON.stringify(source));
    copy.name = `${source.name} (copy)`;
    copy.path = `${source.path}-copy`;
    copy.title = `${source.title ?? source.name} (copy)`;
    setConfig((prev) => {
      const pages = [...prev.pages];
      pages.splice(idx + 1, 0, copy);
      return { ...prev, pages };
    });
    setPageIndex(idx + 1);
    setSelection(null);
  }

  // ── Import / Export ──

  function handleImportYaml(text: string) {
    try {
      const parsed = yaml.load(text) as any;
      if (!parsed || !parsed.pages || !Array.isArray(parsed.pages)) {
        setImportError('Invalid config: must have a "pages" array');
        return;
      }
      if (!parsed.meta) parsed.meta = { name: 'Imported Site' };
      setConfig(parsed as NeucliConfig);
      setPageIndex(0);
      setSelection(null);
      setImportError(null);
      setShowYaml(false);
    } catch (e: any) {
      setImportError(`YAML parse error: ${e.message}`);
    }
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleImportYaml(reader.result as string);
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleExportYaml() {
    const blob = new Blob([yamlText], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.meta.name.toLowerCase().replace(/\s+/g, '-')}.yml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Node operations ──

  function handleAddToPage() {
    setConfig((prev) => addBlockToSections(prev, pageIndex, createDefaultNode(addType, '')));
  }

  function handleAddChild() {
    if (!selection) return;
    setConfig((prev) => addChildBlock(prev, selection, createDefaultNode(addType, '')));
  }

  function handleAddSibling() {
    if (!selection) return;
    setConfig((prev) => addSiblingBlock(prev, selection, createDefaultNode(addType, '')));
  }

  function handleDelete() {
    if (!selection) return;
    setConfig((prev) => deleteBlockAtPath(prev, selection));
    setSelection(null);
  }

  function handleConvertToContainer() {
    if (!selection) return;
    setConfig((prev) => convertToContainer(prev, selection));
  }

  function handleMoveUp(path: number[]) {
    const result = moveNodeInDirection(config, { pageIndex, path }, 'up');
    if (result) {
      setConfig(result.config);
      setSelection({ pageIndex, path: result.newPath });
    }
  }

  function handleMoveDown(path: number[]) {
    const result = moveNodeInDirection(config, { pageIndex, path }, 'down');
    if (result) {
      setConfig(result.config);
      setSelection({ pageIndex, path: result.newPath });
    }
  }

  function handleDrop(fromPath: number[], toParentPath: number[], toIndex: number) {
    const result = moveNodeToPosition(config, pageIndex, fromPath, toParentPath, toIndex);
    if (result) {
      setConfig(result.config);
      setSelection({ pageIndex, path: result.newPath });
    }
  }

  // ── Render ──

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        siteName={config.meta.name}
        addType={addType}
        showYaml={showYaml}
        onAddTypeChange={setAddType}
        onAddToPage={handleAddToPage}
        onImportFile={handleFileImport}
        onExport={handleExportYaml}
        onToggleYaml={() => setShowYaml((v) => !v)}
      />

      <div className="flex min-h-0 flex-1">
        <LeftSidebar
          config={config}
          pageIndex={pageIndex}
          selection={selection}
          onSwitchPage={switchPage}
          onAddPage={addPage}
          onDeletePage={deletePage}
          onDuplicatePage={duplicatePage}
          onUpdatePage={updatePage}
          onUpdateConfig={setConfig}
          onSelectNode={setSelection}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onDrop={handleDrop}
        />

        <Canvas
          config={config}
          pageIndex={pageIndex}
          selection={selection}
          onSwitchPage={switchPage}
          onAddPage={addPage}
          onSelectNode={setSelection}
          onClearSelection={() => setSelection(null)}
          onUpdateConfig={setConfig}
          onDrop={handleDrop}
        />

        <RightPanel
          selectedNode={selectedNode as NeucliNode | null}
          currentPage={currentPage}
          addType={addType}
          hasSelection={!!selection}
          onChangeClassName={(className) => {
            if (selection) setConfig((prev) => updateNodeClassName(prev, selection, className));
          }}
          onChangeText={(text) => {
            if (selection) setConfig((prev) => updateNodeText(prev, selection, text));
          }}
          onChangeProp={(key, value) => {
            if (!selection) return;
            const parsed = key === 'columns' && value.trim() !== '' && !Number.isNaN(Number(value))
              ? Number(value)
              : value;
            setConfig((prev) => updateNodeProp(prev, selection, key, parsed));
          }}
          onChangeLinks={(links) => {
            if (selection) setConfig((prev) => updateNodeLinks(prev, selection, links));
          }}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onDelete={handleDelete}
          onConvertToContainer={handleConvertToContainer}
          onUpdatePage={(updates) => updatePage(pageIndex, updates)}
        />
      </div>

      {showYaml && (
        <YamlDrawer
          yamlText={yamlText}
          pageCount={config.pages.length}
          importError={importError}
          onCopy={() => navigator.clipboard.writeText(yamlText)}
          onExport={handleExportYaml}
          onPasteAndLoad={async () => {
            try {
              const text = await navigator.clipboard.readText();
              handleImportYaml(text);
            } catch {
              setImportError('Clipboard access denied');
            }
          }}
        />
      )}
    </div>
  );
}
