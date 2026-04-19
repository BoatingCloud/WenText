import React, { useEffect, useRef, useState } from 'react';
import { Modal, Spin, Alert } from 'antd';
import { documentReviewApi } from '../../../services/api';

interface AttachmentPreviewProps {
  reviewId: string;
  attachmentId: string;
  fileName: string;
  open: boolean;
  onClose: () => void;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  reviewId,
  attachmentId,
  fileName,
  open,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    const loadEditor = async () => {
      try {
        const response = await documentReviewApi.getAttachmentOnlyOfficeConfig(reviewId, attachmentId);
        if (!mounted) return;

        const data = response.data.data;
        if (!data) {
          setError('获取预览配置失败');
          setLoading(false);
          return;
        }

        // 动态加载 OnlyOffice 脚本
        if (!window.DocsAPI) {
          const script = document.createElement('script');
          script.src = data.scriptUrl;
          script.async = true;
          script.onload = () => {
            if (mounted && window.DocsAPI && containerRef.current) {
              editorRef.current = new window.DocsAPI.DocEditor('onlyoffice-preview-container', data.config);
              setLoading(false);
            }
          };
          script.onerror = () => {
            if (mounted) {
              setError('OnlyOffice 脚本加载失败');
              setLoading(false);
            }
          };
          document.body.appendChild(script);
        } else if (containerRef.current) {
          editorRef.current = new window.DocsAPI.DocEditor('onlyoffice-preview-container', data.config);
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.response?.data?.message || '获取预览配置失败');
          setLoading(false);
        }
      }
    };

    loadEditor();

    return () => {
      mounted = false;
      if (editorRef.current) {
        try {
          editorRef.current.destroyEditor?.();
        } catch {
          // ignore
        }
        editorRef.current = null;
      }
    };
  }, [open, reviewId, attachmentId]);

  return (
    <Modal
      title={`预览 - ${fileName}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20 }}
      styles={{ body: { height: 'calc(100vh - 150px)', padding: 0, overflow: 'hidden' } }}
      destroyOnClose
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Spin size="large" tip="加载预览..." />
        </div>
      )}
      {error && <Alert message="预览失败" description={error} type="error" showIcon />}
      <div
        id="onlyoffice-preview-container"
        ref={containerRef}
        style={{ width: '100%', height: '100%', display: loading || error ? 'none' : 'block' }}
      />
    </Modal>
  );
};

export default AttachmentPreview;
