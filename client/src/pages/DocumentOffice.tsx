import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Spin } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { documentApi } from '../services/api';

interface OnlyOfficeEditorInstance {
  destroyEditor?: () => void;
}

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (containerId: string, config: Record<string, unknown>) => OnlyOfficeEditorInstance;
    };
  }
}

const ONLYOFFICE_SCRIPT_ATTR = 'data-onlyoffice-docsapi';

const loadOnlyOfficeScript = async (src: string): Promise<void> => {
  if (window.DocsAPI?.DocEditor) {
    return;
  }

  const existingScript = document.querySelector(`script[${ONLYOFFICE_SCRIPT_ATTR}="true"]`) as HTMLScriptElement | null;
  if (existingScript && existingScript.src === src) {
    if (existingScript.getAttribute('data-loaded') === 'true') {
      if (!window.DocsAPI?.DocEditor) {
        throw new Error('OnlyOffice script unavailable');
      }
      return;
    }

    await new Promise<void>((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('OnlyOffice script load error')), { once: true });
    });
    return;
  }

  if (existingScript) {
    existingScript.remove();
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(ONLYOFFICE_SCRIPT_ATTR, 'true');
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error('OnlyOffice script load error'));
    document.body.appendChild(script);
  });
};

const DocumentOffice: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { repoId, documentId } = useParams<{ repoId: string; documentId: string }>();
  const editorRef = useRef<OnlyOfficeEditorInstance | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['document-onlyoffice', documentId],
    queryFn: () => documentApi.getOnlyOfficeConfig(documentId!),
    enabled: !!documentId,
    retry: false,
  });

  const onlyOfficeInfo = data?.data.data;
  const editorContainerId = `onlyoffice-editor-${documentId || 'unknown'}`;

  const errorMessage = useMemo(() => {
    const axiosError = error as { response?: { data?: { message?: string } } };
    return axiosError?.response?.data?.message || editorError || '当前文件暂不支持 OnlyOffice 编辑';
  }, [error, editorError]);

  useEffect(() => {
    if (!onlyOfficeInfo) {
      return;
    }

    let cancelled = false;

    const initEditor = async () => {
      try {
        setEditorError(null);
        await loadOnlyOfficeScript(onlyOfficeInfo.scriptUrl);
        if (cancelled || !window.DocsAPI?.DocEditor) {
          return;
        }

        editorRef.current?.destroyEditor?.();
        editorRef.current = new window.DocsAPI.DocEditor(editorContainerId, {
          ...onlyOfficeInfo.config,
          width: '100%',
          height: '100%',
        });
      } catch (e) {
        if (!cancelled) {
          setEditorError('OnlyOffice 编辑器初始化失败');
          message.error('OnlyOffice 编辑器初始化失败');
        }
      }
    };

    void initEditor();

    return () => {
      cancelled = true;
      editorRef.current?.destroyEditor?.();
      editorRef.current = null;
    };
  }, [editorContainerId, message, onlyOfficeInfo]);

  const goBack = () => {
    if (repoId) {
      navigate(`/files/${repoId}`);
      return;
    }
    navigate('/files');
  };

  if (isLoading || isFetching) {
    return (
      <div className="office-loading">
        <Spin />
      </div>
    );
  }

  if (isError || !onlyOfficeInfo || editorError) {
    return (
      <div className="office-page">
        <div className="office-toolbar">
          <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
            返回文件列表
          </Button>
        </div>
        <div className="office-error">
          <h3>OnlyOffice 打开失败</h3>
          <p>{errorMessage}</p>
          <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
            重新加载
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="office-page">
      <div className="office-toolbar">
        <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
          返回
        </Button>
      </div>
      <div
        id={editorContainerId}
        className="office-editor-host"
      />
    </div>
  );
};

export default DocumentOffice;
