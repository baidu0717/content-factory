/**
 * 飞书表格复刻书签工具
 *
 * 使用方法：
 * 1. 在飞书多维表格中选中一行
 * 2. 点击浏览器书签栏的"复刻"书签
 * 3. 自动跳转到复刻页面
 */

javascript:(function(){
  // 获取选中的单元格
  const selectedCells = document.querySelectorAll('[data-testid="cell-container"][class*="selected"]');

  if (selectedCells.length === 0) {
    alert('请先在飞书表格中选中一行');
    return;
  }

  // 获取当前行的数据
  const row = selectedCells[0].closest('[data-testid="row"]');
  if (!row) {
    alert('无法找到选中的行');
    return;
  }

  // 提取标题、正文、标签
  const cells = row.querySelectorAll('[data-testid="cell-container"]');
  const data = {
    title: '',
    content: '',
    tags: ''
  };

  // 尝试从单元格中提取文本
  cells.forEach(cell => {
    const text = cell.innerText.trim();
    const columnHeader = cell.getAttribute('data-column-id');

    // 根据列标题判断字段类型（需要根据实际表格调整）
    if (columnHeader && columnHeader.includes('标题')) {
      data.title = text;
    } else if (columnHeader && columnHeader.includes('正文')) {
      data.content = text;
    } else if (columnHeader && columnHeader.includes('标签')) {
      data.tags = text;
    }
  });

  // 如果自动提取失败，使用prompt手动输入
  if (!data.title) {
    data.title = prompt('请输入标题:');
  }
  if (!data.content) {
    data.content = prompt('请输入正文:');
  }

  if (!data.title || !data.content) {
    alert('标题和正文不能为空');
    return;
  }

  // 构建URL（本地开发版本）
  const baseUrl = 'http://localhost:3000/rewrite';
  const params = new URLSearchParams({
    title: data.title,
    content: data.content,
    tags: data.tags || ''
  });

  // 跳转到复刻页面
  window.open(`${baseUrl}?${params.toString()}`, '_blank');
})();
