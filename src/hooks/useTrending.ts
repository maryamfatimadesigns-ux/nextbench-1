import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import {
  TrendablePost,
  TrendableProduct,
  ScoredPost,
  ScoredProduct,
  computeSchoolTrending,
  computeCityTrending,
  computeTrendingProduct,
  countActiveToday,
} from '../lib/trending';

interface TrendingData {
  schoolTrending: ScoredPost[];
  cityTrending: ScoredPost[];
  trendingProduct: ScoredProduct | null;
  activeToday: number;
  loading: boolean;
}

export function useTrending(): TrendingData {
  const { user, userData } = useAuth();
  const [rawPosts, setRawPosts] = useState<TrendablePost[]>([]);
  const [rawProducts, setRawProducts] = useState<TrendableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  // Only fetch once per user session — trending data doesn't need to be live
  const hasFetched = useRef(false);

  useEffect(() => {
    // Reset when user changes
    hasFetched.current = false;
  }, [user?.uid]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let cancelled = false;
    setLoading(true);

    // Direct Firestore queries — faster than Cloud Function (no cold start),
    // no CORS risk, and works regardless of function deployment status.
    const postsQuery = query(
      collection(db, 'posts'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(40)
    );
    const productsQuery = query(
      collection(db, 'products'),
      where('status', 'in', ['available', 'sold']),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    Promise.all([getDocs(postsQuery), getDocs(productsQuery)])
      .then(([postSnap, productSnap]) => {
        if (cancelled) return;

        setRawPosts(postSnap.docs.map(d => {
          const data = d.data();
          const createdAtMillis = data.createdAt?.toMillis?.() ?? 0;
          return {
            id: d.id,
            title: data.title || '',
            content: data.content || '',
            authorId: data.authorId || '',
            authorName: data.authorName || 'Unknown',
            authorProfilePicture: data.authorProfilePicture || undefined,
            authorUsername: data.authorUsername || null,
            school: data.school || '',
            city: data.city,
            type: data.type || 'others',
            imageUrl: data.imageUrl,
            imageUrls: data.imageUrls,
            upvotesCount: data.upvotesCount || 0,
            repliesCount: data.repliesCount || 0,
            sharesCount: data.sharesCount || 0,
            createdAt: { toMillis: () => createdAtMillis },
          } as TrendablePost;
        }));

        setRawProducts(productSnap.docs.map(d => {
          const data = d.data();
          const createdAtMillis = data.createdAt?.toMillis?.() ?? 0;
          return {
            id: d.id,
            title: data.title || '',
            price: data.price || 0,
            category: data.category || '',
            condition: data.condition || '',
            image: data.image || data.imageUrl || '',
            status: data.status || 'available',
            sellerId: data.sellerId || '',
            sellerName: data.sellerName || 'Unknown',
            sellerSchool: data.sellerSchool || '',
            city: data.city,
            createdAt: { toMillis: () => createdAtMillis },
            wishlistCount: data.wishlistCount || 0,
            inquiryCount: data.inquiryCount || 0,
          } as TrendableProduct;
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Trending: Error fetching data:', error);
          setRawPosts([]);
          setRawProducts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.uid]);

  const schoolTrending = useMemo(() => {
    if (!userData?.school) return [];
    return computeSchoolTrending(rawPosts, userData.school, userData.city, 5);
  }, [rawPosts, userData?.school, userData?.city]);

  const cityTrending = useMemo(() => {
    if (!userData?.city) return [];
    return computeCityTrending(rawPosts, userData.city, 5);
  }, [rawPosts, userData?.city]);

  const trendingProduct = useMemo(() => {
    return computeTrendingProduct(rawProducts);
  }, [rawProducts]);

  const activeToday = useMemo(() => {
    return countActiveToday(rawPosts);
  }, [rawPosts]);

  return { schoolTrending, cityTrending, trendingProduct, activeToday, loading };
}
