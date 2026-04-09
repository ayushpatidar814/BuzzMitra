import { useMemo, useState } from "react";

const VirtualList = ({
  items = [],
  itemHeight = 88,
  overscan = 4,
  height = 420,
  renderItem,
  className = "",
}) => {
  const [scrollTop, setScrollTop] = useState(0);

  const { startIndex, visibleItems, offsetTop, totalHeight } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(height / itemHeight) + overscan * 2;
    const end = Math.min(items.length, start + visibleCount);
    return {
      startIndex: start,
      visibleItems: items.slice(start, end),
      offsetTop: start * itemHeight,
      totalHeight: items.length * itemHeight,
    };
  }, [height, itemHeight, items, overscan, scrollTop]);

  return (
    <div
      className={className}
      style={{ height }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetTop}px)` }}>
          {visibleItems.map((item, index) => renderItem(item, startIndex + index))}
        </div>
      </div>
    </div>
  );
};

export default VirtualList;
