import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Explorer from './App';
import Presentation from './components/Presentation';
import type { DatasetId } from './types';

/** Chuyển giữa màn hình demo và phụ lục; giữ component demo để không mất bước đang xem. */
export default function Shell() {
  const [explore, setExplore] = useState(location.hash.startsWith('#explore'));
  const [dataset, setDataset] = useState<DatasetId>('retailrocket');
  useEffect(() => {
    // Giữ các liên kết cũ hoạt động sau khi đổi từ bài giảng nhiều trang sang một demo.
    const legacy: Record<string, string> = {
      '#rnn-lab': '#reference',
      '#learning': '#reference',
      '#intro': '#demo',
      '#top': '#demo',
      '#datasets': '#demo',
      '#results': '#demo',
      '#resources': '#demo',
      '#datasets-links': '#demo',
      '#evaluation': '#demo',
    };
    const target = legacy[location.hash] || (location.hash.startsWith('#talk/') ? '#demo' : null);
    if (target) history.replaceState(null, '', `${location.pathname}${location.search}${target}`);
  }, []);
  function openExplorer(anchor = 'datasets', selected: DatasetId = 'retailrocket') {
    setDataset(selected);
    setExplore(true);
    history.replaceState(null, '', `#explore-${anchor}`);
    requestAnimationFrame(() =>
      document.getElementById(anchor)?.scrollIntoView({ behavior: 'instant' }),
    );
  }
  function returnToTalk() {
    setExplore(false);
    history.replaceState(null, '', '#demo');
    requestAnimationFrame(() =>
      document.getElementById('demo')?.scrollIntoView({ behavior: 'instant' }),
    );
  }
  return (
    <>
      <div hidden={explore}>
        <Presentation onExplore={openExplorer} active={!explore} />
      </div>
      {explore && (
        <>
          <div className="explorer-return">
            <button onClick={returnToTalk}>
              <ArrowLeft size={16} />
              Về demo
            </button>
            <span>Dữ liệu và công thức</span>
          </div>
          <Explorer key={dataset} initialDataset={dataset} />
        </>
      )}
    </>
  );
}
