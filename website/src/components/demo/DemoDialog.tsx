import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { DemoDataset } from '../../demoTypes';
import QuickAnswers from '../QuickAnswers';
import DatasetDetails from './DatasetDetails';
import RNNCalculation from './RNNCalculation';
import PredictionReadout from './PredictionReadout';
import CodeLink from './CodeLink';

export type DemoModal = 'quick' | 'reference' | 'details' | 'calculation' | null;
interface Props {
  modal: DemoModal;
  data?: DemoDataset;
  read: number;
  predicted: boolean;
  referenceContent: ReactNode;
  onClose: () => void;
  onReference: () => void;
  onExplore: () => void;
}

/** Hộp thoại giữ nguyên dataset/frame ở bên dưới; đóng không tự bật phát lại. */
export default function DemoDialog({
  modal,
  data,
  read,
  predicted,
  referenceContent,
  onClose,
  onReference,
  onExplore,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);

  const title =
    modal === 'quick'
      ? 'Giải thích nhanh'
      : modal === 'reference'
        ? 'Giải thích RNN'
        : modal === 'calculation'
          ? `${data?.title ?? 'RNN'} · phép tính tại bước ${read}`
          : `${data?.title ?? 'Dữ liệu'} · dữ liệu & phép tính`;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="stage-dialog-title"
      className={`stage-dialog ${modal === 'quick' ? 'stage-quick-dialog' : ''}`}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="stage-dialog-header">
        <div>
          <h2 id="stage-dialog-title">{title}</h2>
          <p>Demo đã tạm dừng. Đóng để quay lại đúng chỗ đang xem.</p>
        </div>
        <button onClick={onClose} aria-label="Đóng và về demo">
          <X size={22} />
        </button>
      </div>
      <div className="stage-dialog-body">
        {modal === 'calculation' && data ? (
          <div className="stage-calculation-details">
            <section>
              <h3>Cập nhật một giá trị trạng thái</h3>
              <p>Cùng trọng số từ checkpoint, đầu vào và trạng thái ở bước đang xem.</p>
              <RNNCalculation data={data} read={read} pending={false} />
              <CodeLink source="replay" />
            </section>
            <section>
              <h3>Từ trạng thái cuối đến dự đoán</h3>
              {predicted ? (
                <PredictionReadout data={data} />
              ) : (
                <p>
                  Phép đổi đơn vị xuất hiện sau khi đọc đủ {data.lookback} {data.stepUnit} và đến
                  pha dự đoán.
                </p>
              )}
              <CodeLink source="evaluation" />
            </section>
          </div>
        ) : modal === 'quick' && data ? (
          <QuickAnswers data={data} read={read} onReference={onReference} />
        ) : modal === 'reference' ? (
          referenceContent
        ) : modal === 'details' && data ? (
          <DatasetDetails data={data} read={read} onExplore={onExplore} />
        ) : null}
      </div>
    </dialog>
  );
}
