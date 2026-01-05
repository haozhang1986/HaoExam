import { useState, useCallback, useRef, useEffect } from 'react'

interface UseInfiniteScrollOptions<T> {
  fetchFn: (skip: number, limit: number) => Promise<T[]>
  limit?: number
  threshold?: number
}

interface UseInfiniteScrollResult<T> {
  items: T[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: Error | null
  reset: () => void
  sentinelRef: React.RefObject<HTMLDivElement>
}

export function useInfiniteScroll<T>({
  fetchFn,
  limit = 20,
  threshold = 200
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const skipRef = useRef(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)

  // 初始加载
  const loadInitial = useCallback(async () => {
    if (!isMountedRef.current) return

    setLoading(true)
    setError(null)
    skipRef.current = 0

    try {
      const data = await fetchFn(0, limit)
      if (!isMountedRef.current) return

      setItems(data)
      setHasMore(data.length === limit)
      skipRef.current = data.length
    } catch (err) {
      if (!isMountedRef.current) return
      setError(err as Error)
      console.error('Failed to load initial items:', err)
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [fetchFn, limit])

  // 加载更多
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !isMountedRef.current) return

    setLoadingMore(true)
    try {
      const data = await fetchFn(skipRef.current, limit)
      if (!isMountedRef.current) return

      setItems(prev => [...prev, ...data])
      setHasMore(data.length === limit)
      skipRef.current += data.length
    } catch (err) {
      if (!isMountedRef.current) return
      setError(err as Error)
      console.error('Failed to load more items:', err)
    } finally {
      if (isMountedRef.current) {
        setLoadingMore(false)
      }
    }
  }, [fetchFn, limit, loadingMore, hasMore])

  // 重置 (筛选条件变化时调用)
  const reset = useCallback(() => {
    setItems([])
    setHasMore(true)
    skipRef.current = 0
    loadInitial()
  }, [loadInitial])

  // IntersectionObserver 监听哨兵元素
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore()
        }
      },
      { rootMargin: `${threshold}px` }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, loadMore, threshold])

  // 组件挂载/卸载
  useEffect(() => {
    isMountedRef.current = true
    loadInitial()
    return () => {
      isMountedRef.current = false
    }
  }, []) // 仅首次挂载时执行

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    reset,
    sentinelRef
  }
}
