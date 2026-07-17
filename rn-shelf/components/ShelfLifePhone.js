import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import * as Clipboard from 'expo-clipboard'
import { LinearGradient } from 'expo-linear-gradient'

// ---- Design tokens -------------------------------------------------------
const C = {
  cream: '#F4F1EA',
  ink: '#161616',
  ink2: '#3a3a37',
  muted: '#8a847a',
  muted2: '#9a948c',
  rust: '#B4502E',
  scrim: 'rgba(15,12,10,.62)',
  starEmpty: '#c9c2b6',
  hair: 'rgba(22,22,22,.15)',
  cardHair: 'rgba(0,0,0,.12)',
}

const F = {
  serif: 'Newsreader_400Regular',
  serifMed: 'Newsreader_500Medium',
  serifSemi: 'Newsreader_600SemiBold',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMedItalic: 'Newsreader_500Medium_Italic',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
}

const COVER_W = 86
const COVER_H = 132
const GAP = 13

const BOOKS_KEY = '@shelf_books_v2'
const COVERS_KEY = '@shelf_covers_v2'

const CATS = [
  { key: 'favorites', name: 'favorites' },
  { key: 'everything', name: 'finished' },
  { key: 'reading', name: 'currently reading' },
  { key: 'wishlist', name: 'wishlist' },
]

const SEED = [
  { id: 'b1', cat: 'favorites', title: 'The Stranger', author: 'Albert Camus', genre: 'Fiction', rating: 5, status: 'finished', coverColor: '#8E2B20', coverText: '#F2E7D8', note: '“Mother died today. Or maybe yesterday.” A book that taught me how much you can say by saying almost nothing.' },
  { id: 'b2', cat: 'favorites', title: 'Bluets', author: 'Maggie Nelson', genre: 'Essays', rating: 4, status: 'finished', coverColor: '#28508C', coverText: '#EAF0F7', note: '240 small blue stones, held up to the light one at a time. I keep coming back to it.' },
  { id: 'b3', cat: 'favorites', title: 'Just Kids', author: 'Patti Smith', genre: 'Memoir', rating: 5, status: 'reading', coverColor: '#161616', coverText: '#EDE7DA', note: 'The tenderest portrait of two kids becoming artists in a city that no longer exists.' },
  { id: 'b4', cat: 'everything', title: 'Crying in H Mart', author: 'Michelle Zauner', genre: 'Memoir', rating: 4, status: 'finished', coverColor: '#B5341F', coverText: '#F4E9DB', note: 'Grief, kimchi, and the particular ache of a mother’s recipes.' },
  { id: 'b5', cat: 'reading', title: 'Pachinko', author: 'Min Jin Lee', genre: 'Fiction', rating: 5, status: 'reading', coverColor: '#34406B', coverText: '#E9ECF4', note: '“History has failed us, but no matter.” I read the last hundred pages in one sitting.' },
  { id: 'b6', cat: 'everything', title: 'The Argonauts', author: 'Maggie Nelson', genre: 'Essays', rating: 4, status: 'finished', coverColor: '#D9772E', coverText: '#211405', note: 'On love, language, and bodies that refuse to be one thing.' },
  { id: 'b7', cat: 'wishlist', title: 'Trust', author: 'Hernan Diaz', genre: 'Fiction', rating: 0, status: 'to-read', coverColor: '#243B2E', coverText: '#E6EDE6', note: '' },
  { id: 'b8', cat: 'wishlist', title: 'The Dawn of Everything', author: 'Graeber & Wengrow', genre: 'History', rating: 0, status: 'to-read', coverColor: '#C99A2E', coverText: '#1C1505', note: '' },
  { id: 'b9', cat: 'wishlist', title: 'Severance', author: 'Ling Ma', genre: 'Fiction', rating: 0, status: 'to-read', coverColor: '#2E2A4A', coverText: '#E8E5F0', note: '' },
]

const PALETTE = [
  { c: '#8E2B20', t: '#F2E7D8' },
  { c: '#28508C', t: '#EAF0F7' },
  { c: '#243B2E', t: '#E6EDE6' },
  { c: '#C99A2E', t: '#1C1505' },
]

const STATUS_MAP = { favorites: 'finished', everything: 'finished', reading: 'reading', wishlist: 'to-read' }

const catName = (key) => (CATS.find((c) => c.key === key) || {}).name || ''
const statusLabel = (s) => (s === 'finished' ? 'Finished' : s === 'reading' ? 'Reading' : 'To read')
const statusDot = (s) => (s === 'finished' ? '#2f7d4f' : s === 'reading' ? '#d98a2b' : '#a7a7a7')

// ---- Cover fetching ------------------------------------------------------
async function fetchCoverUrl(title, author) {
  try {
    const q = encodeURIComponent(`${title} ${author}`)
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`)
    if (r.ok) {
      const d = await r.json()
      const links = d.items && d.items[0] && d.items[0].volumeInfo && d.items[0].volumeInfo.imageLinks
      const raw = links && (links.thumbnail || links.smallThumbnail)
      if (raw) {
        return raw.replace('http://', 'https://').replace('&edge=curl', '').replace('zoom=1', 'zoom=2')
      }
    }
  } catch (e) {}
  try {
    const t = encodeURIComponent(title)
    const a = encodeURIComponent(author)
    const r = await fetch(`https://openlibrary.org/search.json?title=${t}&author=${a}&limit=1`)
    if (r.ok) {
      const d = await r.json()
      const doc = d.docs && d.docs[0]
      if (doc && doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    }
  } catch (e) {}
  return null
}

async function searchCandidates(title) {
  const q = encodeURIComponent(title)
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=10`)
    if (r.ok) {
      const d = await r.json()
      const items = (d.items || []).filter((x) => x.volumeInfo && x.volumeInfo.imageLinks)
      if (items.length) {
        return items.slice(0, 8).map((x) => {
          const v = x.volumeInfo
          const raw = v.imageLinks.thumbnail || v.imageLinks.smallThumbnail
          return {
            title: v.title,
            author: (v.authors && v.authors[0]) || 'Unknown',
            year: v.publishedDate ? v.publishedDate.slice(0, 4) : null,
            coverUrl: raw.replace('http://', 'https://').replace('&edge=curl', '').replace('zoom=1', 'zoom=2'),
          }
        })
      }
    }
  } catch (e) {}
  // Open Library fallback
  try {
    const r = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=10&fields=title,author_name,first_publish_year,cover_i,edition_count`)
    if (r.ok) {
      const d = await r.json()
      const docs = (d.docs || []).filter((x) => x.cover_i)
      docs.sort((a, b) => (b.edition_count || 0) - (a.edition_count || 0))
      return docs.slice(0, 8).map((x) => ({
        title: x.title,
        author: (x.author_name && x.author_name[0]) || 'Unknown',
        year: x.first_publish_year || null,
        coverUrl: `https://covers.openlibrary.org/b/id/${x.cover_i}-L.jpg`,
      }))
    }
  } catch (e) {}
  return []
}

// ---- Cover art (used on home + popup + add) ------------------------------
function Cover({ book, coverUrl, width, height, style, titleSize = 11.5, authorSize = 6, pad = [10, 9] }) {
  return (
    <View style={[{ width, height, backgroundColor: book.coverColor, overflow: 'hidden' }, style]}>
      {coverUrl ? (
        <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: pad[0], paddingHorizontal: pad[1] }}>
          <Text style={{ fontFamily: F.serifSemi, fontSize: titleSize, lineHeight: titleSize * 1.06, color: book.coverText }}>{book.title}</Text>
          <Text style={{ fontFamily: F.mono, fontSize: authorSize, letterSpacing: 0.4, color: book.coverText, opacity: 0.78, textTransform: 'uppercase' }}>{book.author}</Text>
        </View>
      )}
    </View>
  )
}

export default function ShelfLifePhone() {
  const [books, setBooks] = useState(SEED)
  const [covers, setCovers] = useState({})
  const [loaded, setLoaded] = useState(false)

  const [openId, setOpenId] = useState(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [noteEditId, setNoteEditId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [editingAuthorId, setEditingAuthorId] = useState(null)
  const [authorDraft, setAuthorDraft] = useState('')
  const [coverMenuOpen, setCoverMenuOpen] = useState(false)
  const [coverMenuHasImage, setCoverMenuHasImage] = useState(false)
  const [toast, setToast] = useState(null)

  // Add modal
  const [addOpen, setAddOpen] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addAuthor, setAddAuthor] = useState('')
  const [addShelf, setAddShelf] = useState('favorites')
  const [addCoverUrl, setAddCoverUrl] = useState(null)
  const [addYear, setAddYear] = useState(null)
  const [addLoading, setAddLoading] = useState(false)
  const [addCandidates, setAddCandidates] = useState([])
  const [addSelected, setAddSelected] = useState(false)
  const [addManual, setAddManual] = useState(false)

  // Drag
  const [dragId, setDragId] = useState(null)
  const [dragBook, setDragBook] = useState(null)
  const ghostPos = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current

  const toastTimer = useRef(null)
  const addTimer = useRef(null)
  const addSeq = useRef(0)
  const dragActiveRef = useRef(false)
  const lastTouch = useRef({ x: 0, y: 0 })
  const origCat = useRef(null)
  const lastReorderKey = useRef(null)
  const bookRefs = useRef({})
  const rowRefs = useRef({})
  const layouts = useRef({ books: {}, rows: {} })
  const uploadTarget = useRef('book')

  // ---- persistence -------------------------------------------------------
  useEffect(() => {
    ;(async () => {
      try {
        const [rawB, rawC] = await Promise.all([
          AsyncStorage.getItem(BOOKS_KEY),
          AsyncStorage.getItem(COVERS_KEY),
        ])
        if (rawB) setBooks(JSON.parse(rawB))
        if (rawC) setCovers(JSON.parse(rawC))
      } catch (e) {}
      setLoaded(true)
    })()
  }, [])

  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(books)).catch(() => {})
  }, [books, loaded])
  useEffect(() => {
    if (!loaded) return
    AsyncStorage.setItem(COVERS_KEY, JSON.stringify(covers)).catch(() => {})
  }, [covers, loaded])

  // ---- auto cover fetch --------------------------------------------------
  useEffect(() => {
    if (!loaded) return
    books.forEach((b) => {
      if (covers[b.id]) return
      fetchCoverUrl(b.title, b.author).then((url) => {
        if (url) setCovers((prev) => (prev[b.id] ? prev : { ...prev, [b.id]: url }))
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, books.length])

  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 1800)
  }, [])

  const cur = useMemo(() => books.find((b) => b.id === openId) || null, [books, openId])

  const update = useCallback((id, patch) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }, [])

  // ---- popup actions -----------------------------------------------------
  const open = (id) => {
    if (dragActiveRef.current) return
    setOpenId(id)
    setMoveOpen(false)
    setNoteEditId(null)
    setEditingAuthorId(null)
  }
  const close = () => {
    setOpenId(null)
    setMoveOpen(false)
    setNoteEditId(null)
    setEditingAuthorId(null)
    setCoverMenuOpen(false)
  }
  const cycleStatus = () => {
    if (!cur) return
    const order = ['to-read', 'reading', 'finished']
    const next = order[(order.indexOf(cur.status) + 1) % 3]
    update(cur.id, { status: next })
    showToast('Status → ' + statusLabel(next))
  }
  const markFinished = () => {
    if (!cur) return
    if (cur.status === 'finished') { showToast('Already finished'); return }
    update(cur.id, { status: 'finished' })
    showToast('Marked as finished')
  }
  const setRating = (n) => {
    if (!cur) return
    update(cur.id, { rating: n })
    showToast(n + ' star' + (n !== 1 ? 's' : ''))
  }
  const share = () => showToast('Link copied to clipboard')
  const del = () => {
    if (!cur) return
    const id = cur.id
    setBooks((prev) => prev.filter((b) => b.id !== id))
    close()
    showToast('Removed from shelf')
  }
  const moveTo = (key) => {
    if (!cur) return
    update(cur.id, { cat: key })
    setMoveOpen(false)
    showToast('Moved to ' + catName(key))
  }

  const startAuthorEdit = () => {
    if (!cur) return
    setMoveOpen(false)
    setNoteEditId(null)
    setAuthorDraft(cur.author)
    setEditingAuthorId(cur.id)
  }
  const saveAuthorEdit = () => {
    if (!cur) { setEditingAuthorId(null); return }
    const a = authorDraft.trim() || cur.author
    update(cur.id, { author: a })
    setEditingAuthorId(null)
  }

  const startNote = () => {
    if (!cur) return
    setMoveOpen(false)
    setEditingAuthorId(null)
    setNoteDraft(cur.note || '')
    setNoteEditId(cur.id)
  }
  const saveNote = () => {
    if (!cur) return
    update(cur.id, { note: noteDraft })
    setNoteEditId(null)
    showToast('Note saved')
  }

  // ---- cover replacement -------------------------------------------------
  const applyCover = (uri, target) => {
    if (target === 'add') {
      setAddCoverUrl(uri)
      setAddSelected(true)
      setAddManual(false)
      setAddCandidates([])
    } else if (cur) {
      setCovers((prev) => ({ ...prev, [cur.id]: uri }))
    }
    showToast('Cover updated')
  }

  const pickPhoto = async (target) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) { showToast('Photo access needed'); return }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions ? ImagePicker.MediaTypeOptions.Images : ['images'],
        quality: 0.9,
      })
      if (res.canceled || !res.assets || !res.assets[0]) return
      applyCover(res.assets[0].uri, target)
    } catch (e) {
      showToast('Could not open library')
    }
  }

  const openCoverMenu = async () => {
    setCoverMenuOpen(true)
    try {
      const has = await Clipboard.hasImageAsync()
      setCoverMenuHasImage(!!has)
    } catch (e) {
      setCoverMenuHasImage(false)
    }
  }
  const chooseUpload = () => {
    setCoverMenuOpen(false)
    pickPhoto('book')
  }
  const choosePaste = async () => {
    if (!coverMenuHasImage) return
    try {
      const img = await Clipboard.getImageAsync({ format: 'png' })
      if (img && img.data) applyCover(img.data, 'book')
    } catch (e) {}
    setCoverMenuOpen(false)
  }

  // ---- Add modal ---------------------------------------------------------
  const openAdd = (shelf) => {
    setAddOpen(true)
    setAddTitle('')
    setAddAuthor('')
    setAddShelf(shelf || 'favorites')
    setAddCoverUrl(null)
    setAddYear(null)
    setAddLoading(false)
    setAddCandidates([])
    setAddSelected(false)
    setAddManual(false)
  }
  const runSearch = (title) => {
    clearTimeout(addTimer.current)
    addTimer.current = setTimeout(async () => {
      const t = title.trim()
      if (!t) { setAddCandidates([]); setAddLoading(false); return }
      const seq = ++addSeq.current
      setAddLoading(true)
      const results = await searchCandidates(t)
      if (seq !== addSeq.current) return
      setAddCandidates(results)
      setAddLoading(false)
    }, 450)
  }
  const onAddTitle = (t) => {
    setAddTitle(t)
    setAddSelected(false)
    setAddCoverUrl(null)
    setAddAuthor('')
    setAddYear(null)
    runSearch(t)
  }
  const selectCandidate = (c) => {
    setAddTitle(c.title)
    setAddAuthor(c.author)
    setAddYear(c.year)
    setAddCoverUrl(c.coverUrl)
    setAddCandidates([])
    setAddSelected(true)
    setAddManual(false)
  }
  const changeSelection = () => {
    setAddSelected(false)
    setAddCoverUrl(null)
    setAddAuthor('')
    setAddYear(null)
    runSearch(addTitle)
  }
  const submitAdd = () => {
    const title = addTitle.trim()
    if (!title) return
    const p = PALETTE[books.length % PALETTE.length]
    const id = 'b' + Date.now()
    const nb = {
      id,
      cat: addShelf,
      title,
      author: addAuthor.trim() || 'Unknown',
      genre: 'General',
      rating: 0,
      status: STATUS_MAP[addShelf] || 'to-read',
      coverColor: p.c,
      coverText: p.t,
      note: '',
    }
    setBooks((prev) => [...prev, nb])
    if (addCoverUrl) setCovers((prev) => ({ ...prev, [id]: addCoverUrl }))
    setAddOpen(false)
    showToast('Added to ' + catName(addShelf))
  }

  // ---- drag & drop -------------------------------------------------------
  const measureAll = useCallback(() => {
    Object.entries(bookRefs.current).forEach(([id, ref]) => {
      if (ref && ref.measureInWindow) {
        ref.measureInWindow((x, y, w, h) => {
          layouts.current.books[id] = { x, y, w, h }
        })
      }
    })
    Object.entries(rowRefs.current).forEach(([key, ref]) => {
      if (ref && ref.measureInWindow) {
        ref.measureInWindow((x, y, w, h) => {
          layouts.current.rows[key] = { x, y, w, h }
        })
      }
    })
  }, [])

  const activateDrag = (book) => {
    dragActiveRef.current = true
    origCat.current = book.cat
    lastReorderKey.current = null
    ghostPos.setValue({ x: lastTouch.current.x, y: lastTouch.current.y })
    setDragId(book.id)
    setDragBook(book)
    measureAll()
  }

  const doReorder = (id, targetCat, insertBeforeId) => {
    setBooks((prev) => {
      const book = prev.find((b) => b.id === id)
      if (!book) return prev
      const rest = prev.filter((b) => b.id !== id)
      let idx
      if (insertBeforeId) {
        idx = rest.findIndex((b) => b.id === insertBeforeId)
        if (idx < 0) idx = rest.length
      } else {
        let last = -1
        rest.forEach((b, i) => { if (b.cat === targetCat) last = i })
        idx = last >= 0 ? last + 1 : rest.length
      }
      const moved = { ...book, cat: targetCat }
      const next = rest.slice()
      next.splice(idx, 0, moved)
      const same = next.length === prev.length && next.every((b, i) => b.id === prev[i].id && b.cat === prev[i].cat)
      return same ? prev : next
    })
    setTimeout(measureAll, 0)
  }

  const handleDragMove = (pageX, pageY) => {
    ghostPos.setValue({ x: pageX, y: pageY })
    // find target shelf by row band
    let targetCat = null
    Object.entries(layouts.current.rows).forEach(([key, r]) => {
      if (pageY >= r.y - 10 && pageY <= r.y + r.h + 10) targetCat = key
    })
    if (!targetCat) {
      // nearest row
      let best = null
      let bestD = Infinity
      Object.entries(layouts.current.rows).forEach(([key, r]) => {
        const cy = r.y + r.h / 2
        const d = Math.abs(cy - pageY)
        if (d < bestD) { bestD = d; best = key }
      })
      targetCat = best
    }
    if (!targetCat) return
    const inCat = books.filter((b) => b.cat === targetCat && b.id !== dragId)
    let insertBeforeId = null
    for (const b of inCat) {
      const lb = layouts.current.books[b.id]
      if (lb && pageX < lb.x + lb.w / 2) { insertBeforeId = b.id; break }
    }
    const key = targetCat + '|' + insertBeforeId
    if (lastReorderKey.current !== key) {
      lastReorderKey.current = key
      doReorder(dragId, targetCat, insertBeforeId)
    }
  }

  const finishDrag = () => {
    const id = dragId
    dragActiveRef.current = false
    setDragId(null)
    setDragBook(null)
    if (id) {
      const b = books.find((x) => x.id === id)
      if (b && origCat.current && b.cat !== origCat.current) {
        showToast('Moved to ' + catName(b.cat))
      }
    }
    origCat.current = null
    lastReorderKey.current = null
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        lastTouch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
        return false
      },
      onMoveShouldSetPanResponderCapture: (e) => {
        lastTouch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
        return dragActiveRef.current
      },
      onPanResponderMove: (e) => {
        if (!dragActiveRef.current) return
        handleDragMoveRef.current(e.nativeEvent.pageX, e.nativeEvent.pageY)
      },
      onPanResponderRelease: () => finishDragRef.current(),
      onPanResponderTerminate: () => finishDragRef.current(),
      onPanResponderTerminationRequest: () => !dragActiveRef.current,
    })
  ).current

  // keep latest closures accessible to the (stable) panResponder
  const handleDragMoveRef = useRef(handleDragMove)
  const finishDragRef = useRef(finishDrag)
  handleDragMoveRef.current = handleDragMove
  finishDragRef.current = finishDrag

  // ---- render ------------------------------------------------------------
  const grouped = useMemo(() => {
    return CATS.map((c, i) => {
      const list = books.filter((b) => b.cat === c.key)
      return {
        ...c,
        no: '0' + (i + 1),
        books: list,
        countLabel: list.length + ' book' + (list.length !== 1 ? 's' : ''),
      }
    })
  }, [books])

  return (
    <View style={styles.stage} {...panResponder.panHandlers}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!dragId}
      >
        <View style={styles.header}>
          <Text style={styles.wordmark}>Shelf</Text>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>What I've Been Reading</Text>
            <View style={styles.dividerLine} />
          </View>
        </View>

        {grouped.map((cat) => (
          <View key={cat.key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionNo}>{cat.no}</Text>
                <Text style={styles.sectionName}>{cat.name}</Text>
              </View>
              <View style={styles.sectionHeaderRight}>
                <Text style={styles.countLabel}>{cat.countLabel}</Text>
                <Text style={styles.chevrons}>‹ ›</Text>
              </View>
            </View>

            <View
              ref={(r) => { rowRefs.current[cat.key] = r }}
              collapsable={false}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEnabled={!dragId}
                contentContainerStyle={styles.rowContent}
              >
                {cat.books.map((book) => {
                  const isDragging = dragId === book.id
                  return (
                    <Pressable
                      key={book.id}
                      ref={(r) => { bookRefs.current[book.id] = r }}
                      collapsable={false}
                      delayLongPress={300}
                      onLongPress={() => activateDrag(book)}
                      onPress={() => open(book.id)}
                      style={[styles.coverShadow, { opacity: isDragging ? 0 : 1 }]}
                    >
                      <Cover book={book} coverUrl={covers[book.id]} width={COVER_W} height={COVER_H} />
                    </Pressable>
                  )
                })}
                <Pressable style={styles.addTile} onPress={() => openAdd(cat.key)}>
                  <Text style={styles.addTilePlus}>+</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* bottom fade + Add Books */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <LinearGradient
          style={styles.bottomFade}
          pointerEvents="none"
          colors={['rgba(244,241,234,0)', 'rgba(244,241,234,0.7)', '#F4F1EA']}
          locations={[0, 0.45, 1]}
        />
        <Pressable style={styles.addBooksBtn} onPress={() => openAdd('favorites')}>
          <Text style={styles.addBooksPlus}>+</Text>
          <Text style={styles.addBooksText}>Add Books</Text>
        </Pressable>
      </View>

      {/* drag ghost */}
      {dragId && dragBook && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ghost,
            {
              width: COVER_W,
              height: COVER_H,
              transform: [
                { translateX: Animated.subtract(ghostPos.x, COVER_W / 2) },
                { translateY: Animated.subtract(ghostPos.y, COVER_H / 2) },
                { scale: 1.14 },
                { rotate: '-3deg' },
              ],
            },
          ]}
        >
          <Cover book={dragBook} coverUrl={covers[dragBook.id]} width={COVER_W} height={COVER_H} />
        </Animated.View>
      )}

      <DetailPopup
        book={cur}
        coverUrl={cur ? covers[cur.id] : null}
        onClose={close}
        rust={C.rust}
        moveOpen={moveOpen}
        setMoveOpen={setMoveOpen}
        editingAuthor={editingAuthorId === (cur && cur.id)}
        authorDraft={authorDraft}
        setAuthorDraft={setAuthorDraft}
        startAuthorEdit={startAuthorEdit}
        saveAuthorEdit={saveAuthorEdit}
        noteEditing={noteEditId === (cur && cur.id)}
        noteDraft={noteDraft}
        setNoteDraft={setNoteDraft}
        startNote={startNote}
        saveNote={saveNote}
        cancelNote={() => setNoteEditId(null)}
        setRating={setRating}
        cycleStatus={cycleStatus}
        markFinished={markFinished}
        share={share}
        del={del}
        moveTo={moveTo}
        openCoverMenu={openCoverMenu}
        coverMenuOpen={coverMenuOpen}
        coverMenuHasImage={coverMenuHasImage}
        closeCoverMenu={() => setCoverMenuOpen(false)}
        chooseUpload={chooseUpload}
        choosePaste={choosePaste}
        replaceCover={() => pickPhoto('book')}
      />

      <AddModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        rust={C.rust}
        title={addTitle}
        onTitle={onAddTitle}
        author={addAuthor}
        setAuthor={setAddAuthor}
        year={addYear}
        loading={addLoading}
        candidates={addCandidates}
        selected={addSelected}
        manual={addManual}
        coverUrl={addCoverUrl}
        selectCandidate={selectCandidate}
        changeSelection={changeSelection}
        toggleManual={() => { setAddManual((m) => !m); setAddCandidates([]) }}
        shelf={addShelf}
        setShelf={setAddShelf}
        submit={submitAdd}
        onCoverPress={() => pickPhoto('add')}
      />

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  )
}

// ---- Detail popup (Editorial) --------------------------------------------
function DetailPopup(props) {
  const {
    book, coverUrl, onClose, rust, moveOpen, setMoveOpen,
    editingAuthor, authorDraft, setAuthorDraft, startAuthorEdit, saveAuthorEdit,
    noteEditing, noteDraft, setNoteDraft, startNote, saveNote, cancelNote,
    setRating, cycleStatus, markFinished, share, del, moveTo,
    openCoverMenu, coverMenuOpen, coverMenuHasImage, closeCoverMenu, chooseUpload, choosePaste, replaceCover,
  } = props

  const hasNote = !!(book && book.note && book.note.length)
  const shelf = book ? catName(book.cat) : ''
  const moveTargets = book ? CATS.filter((c) => c.key !== book.cat) : []

  return (
    <Modal visible={!!book} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {book && (
            <>
              <View style={styles.cardHeader}>
                <View style={styles.logoMark}>
                  <View style={styles.logoNotch} />
                </View>
                <Pressable onPress={onClose}>
                  <Text style={styles.closeLabel}>CLOSE</Text>
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable style={styles.heroWrap} onPress={openCoverMenu}>
                  <Cover book={book} coverUrl={coverUrl} width={150} height={150 * (COVER_H / COVER_W)} titleSize={26} authorSize={8} pad={[20, 18]} style={styles.heroShadow} />
                  {coverMenuOpen && (
                    <Pressable style={styles.coverMenu} onPress={closeCoverMenu}>
                      <Pressable style={styles.coverPill} onPress={chooseUpload}>
                        <Text style={styles.coverPillText}>Upload Photo</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.coverPill, { borderColor: coverMenuHasImage ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.25)' }]}
                        onPress={choosePaste}
                      >
                        <Text style={[styles.coverPillText, { color: coverMenuHasImage ? '#fff' : 'rgba(255,255,255,.4)' }]}>
                          {coverMenuHasImage ? 'Paste Image' : 'No image copied to clipboard'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  )}
                </Pressable>

                <View style={styles.cardBody}>
                  <Text style={styles.eyebrow}>{(book.genre || '').toUpperCase()} · {shelf.toUpperCase()}</Text>
                  <Text style={styles.detailTitle}>{book.title}</Text>

                  <View style={styles.authorRow}>
                    {editingAuthor ? (
                      <TextInput
                        style={styles.authorInput}
                        value={authorDraft}
                        onChangeText={setAuthorDraft}
                        onBlur={saveAuthorEdit}
                        onSubmitEditing={saveAuthorEdit}
                        autoFocus
                      />
                    ) : (
                      <Pressable style={{ flex: 1 }} onPress={startAuthorEdit}>
                        <Text style={styles.authorText}>{book.author}</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.shareBtn} onPress={share}>
                      <Text style={styles.shareGlyph}>↗</Text>
                    </Pressable>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.ratingRow}>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable key={n} onPress={() => setRating(n)}>
                          <Text style={[styles.star, { color: n <= book.rating ? C.ink : C.starEmpty }]}>
                            {n <= book.rating ? '★' : '☆'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable style={styles.statusPill} onPress={cycleStatus}>
                      <View style={[styles.statusDot, { backgroundColor: statusDot(book.status) }]} />
                      <Text style={styles.statusText}>{statusLabel(book.status)}</Text>
                    </Pressable>
                  </View>

                  {noteEditing ? (
                    <View style={{ marginTop: 14 }}>
                      <TextInput
                        style={styles.noteInput}
                        value={noteDraft}
                        onChangeText={setNoteDraft}
                        placeholder="Add a note or a favourite quote…"
                        placeholderTextColor="#a59f95"
                        multiline
                      />
                      <View style={styles.noteActions}>
                        <Pressable style={styles.saveBtn} onPress={saveNote}>
                          <Text style={styles.saveBtnText}>Save</Text>
                        </Pressable>
                        <Pressable onPress={cancelNote}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable style={styles.noteQuote} onPress={startNote}>
                      <Text style={[styles.noteText, { color: hasNote ? '#2c2c29' : '#a59f95' }]}>
                        {hasNote ? book.note : 'Tap to add a note or a favourite quote…'}
                      </Text>
                    </Pressable>
                  )}

                  <Pressable style={styles.primaryBtn} onPress={markFinished}>
                    <Text style={styles.primaryBtnText}>{book.status === 'finished' ? 'Finished ✓' : 'Mark as finished'}</Text>
                  </Pressable>

                  <View style={styles.actionsRow}>
                    <Pressable onPress={startAuthorEdit}><Text style={styles.actionText}>Edit</Text></Pressable>
                    <Pressable onPress={startNote}><Text style={styles.actionText}>Note</Text></Pressable>
                    <Pressable onPress={() => setMoveOpen((m) => !m)}><Text style={styles.actionText}>Move</Text></Pressable>
                    <Pressable onPress={replaceCover}><Text style={styles.actionText}>Replace cover</Text></Pressable>
                    <Pressable onPress={del}><Text style={[styles.actionText, { color: C.rust }]}>Delete</Text></Pressable>
                  </View>

                  {moveOpen && (
                    <View style={styles.moveList}>
                      <Text style={styles.moveLabel}>Move to shelf</Text>
                      {moveTargets.map((m) => (
                        <Pressable key={m.key} style={styles.moveRow} onPress={() => moveTo(m.key)}>
                          <Text style={styles.moveName}>{m.name}</Text>
                          <Text style={styles.moveArrow}>→</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ---- Add modal -----------------------------------------------------------
function AddModal(props) {
  const {
    visible, onClose, rust, title, onTitle, author, setAuthor, year,
    loading, candidates, selected, manual, coverUrl, selectCandidate,
    changeSelection, toggleManual, shelf, setShelf, submit, onCoverPress,
  } = props

  const showCandidates = !selected && !manual && candidates.length > 0
  const showManualToggle = !selected && title.trim().length > 0 && !loading

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.cardHeader}>
            <View style={styles.logoMark}><View style={styles.logoNotch} /></View>
            <Pressable onPress={onClose}><Text style={styles.closeLabel}>CLOSE</Text></Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.addBody} keyboardShouldPersistTaps="handled">
            <Text style={[styles.eyebrow, { letterSpacing: 2.5 }]}>NEW ENTRY</Text>
            <Text style={styles.addTitle}>Add a Book</Text>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={onTitle}
                placeholder="Start typing a title…"
                placeholderTextColor="#a59f95"
              />
            </View>

            {selected && (
              <View style={styles.selectedRow}>
                <Pressable style={styles.selectedThumb} onPress={onCoverPress}>
                  {coverUrl ? <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                </Pressable>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.selectedAuthor}>{author}</Text>
                  {year ? <Text style={styles.selectedYear}>First published {year}</Text> : null}
                </View>
                <Pressable onPress={changeSelection}>
                  <Text style={styles.changeLink}>Change</Text>
                </Pressable>
              </View>
            )}

            {showCandidates && (
              <ScrollView
                style={styles.candidateList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {candidates.map((c, i) => (
                  <Pressable key={i} style={styles.candidateRow} onPress={() => selectCandidate(c)}>
                    <View style={styles.candidateThumb}>
                      <Image source={{ uri: c.coverUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.candidateTitle} numberOfLines={1}>{c.title}</Text>
                      <Text style={styles.candidateCaption}>{c.author}{c.year ? ' · ' + c.year : ''}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {loading && <Text style={styles.searching}>Searching…</Text>}

            {manual && (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.fieldLabel}>Author (no cover found)</Text>
                <TextInput
                  style={styles.manualAuthor}
                  value={author}
                  onChangeText={setAuthor}
                  placeholder="Author name"
                  placeholderTextColor="#a59f95"
                />
              </View>
            )}
            {showManualToggle && (
              <Pressable onPress={toggleManual}>
                <Text style={styles.manualToggle}>{manual ? 'Search instead' : "Can't find it? Enter manually"}</Text>
              </Pressable>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 18, marginBottom: 8 }]}>Shelf</Text>
            <View style={styles.chipRow}>
              {CATS.map((c) => {
                const active = shelf === c.key
                return (
                  <Pressable
                    key={c.key}
                    style={[styles.chip, { backgroundColor: active ? C.ink : 'transparent', borderColor: active ? C.ink : 'rgba(22,22,22,.25)' }]}
                    onPress={() => setShelf(c.key)}
                  >
                    <Text style={[styles.chipText, { color: active ? C.cream : '#5a5450' }]}>{c.name}</Text>
                  </Pressable>
                )
              })}
            </View>

            <Pressable style={[styles.primaryBtn, { marginTop: 22, backgroundColor: title.trim() ? C.ink : '#c8c2b6' }]} onPress={submit}>
              <Text style={styles.primaryBtnText}>+ Add to Shelf</Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: C.cream },
  screen: { flex: 1 },
  scrollContent: { paddingTop: 96, paddingLeft: 30, paddingRight: 16, paddingBottom: 200 },

  header: { alignItems: 'center', marginBottom: 36 },
  wordmark: { fontFamily: F.serifSemi, fontSize: 26, letterSpacing: -0.5, color: C.ink, lineHeight: 26 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  dividerLine: { width: 34, height: 1, backgroundColor: 'rgba(22,22,22,.28)' },
  dividerText: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 2, color: C.muted, textTransform: 'uppercase', marginHorizontal: 10 },

  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderBottomWidth: 1, borderBottomColor: C.hair, paddingBottom: 9, marginBottom: 16, paddingRight: 14 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'baseline' },
  sectionNo: { fontFamily: F.mono, fontSize: 9, letterSpacing: 2, color: C.rust, marginRight: 8 },
  sectionName: { fontFamily: F.serifItalic, fontSize: 19, color: C.ink, textTransform: 'capitalize' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  countLabel: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.5, color: C.muted2, textTransform: 'uppercase', marginRight: 9 },
  chevrons: { color: '#b0a99e', fontSize: 12, fontWeight: '700' },

  rowContent: { gap: GAP, paddingBottom: 2 },
  coverShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 6,
  },
  addTile: { width: COVER_W, height: COVER_H, borderWidth: 1, borderColor: 'rgba(22,22,22,.3)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  addTilePlus: { fontFamily: F.mono, fontSize: 20, color: C.muted },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 30 },
  bottomFade: { ...StyleSheet.absoluteFillObject },
  addBooksBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.ink, borderRadius: 2, paddingVertical: 14, paddingHorizontal: 34, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 24, elevation: 10 },
  addBooksPlus: { fontFamily: F.mono, fontSize: 13, color: C.cream, marginRight: 10 },
  addBooksText: { fontFamily: F.mono, fontSize: 11, letterSpacing: 2, color: C.cream, textTransform: 'uppercase' },

  ghost: { position: 'absolute', left: 0, top: 0, zIndex: 200, shadowColor: '#000', shadowOffset: { width: 0, height: 26 }, shadowOpacity: 0.5, shadowRadius: 50, elevation: 30 },

  // popup
  backdrop: { flex: 1, backgroundColor: C.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 20 },
  card: { width: 300, maxWidth: '100%', maxHeight: 670, backgroundColor: C.cream, borderRadius: 3, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 34 }, shadowOpacity: 0.5, shadowRadius: 80, elevation: 40 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 },
  logoMark: { width: 15, height: 15, backgroundColor: C.ink },
  logoNotch: { position: 'absolute', top: 0, right: 0, width: 6, height: 6, backgroundColor: C.cream },
  closeLabel: { fontFamily: F.mono, fontSize: 10, letterSpacing: 2, color: C.ink },

  heroWrap: { width: 150, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  heroShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 26, elevation: 12 },
  coverMenu: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center' },
  coverPill: { borderWidth: 1, borderColor: 'rgba(255,255,255,.55)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, marginVertical: 5 },
  coverPillText: { fontFamily: F.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#fff' },

  cardBody: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  eyebrow: { fontFamily: F.mono, fontSize: 9, letterSpacing: 2.4, color: C.rust, textTransform: 'uppercase' },
  detailTitle: { fontFamily: F.serif, fontSize: 27, lineHeight: 27 * 1.07, color: C.ink, marginTop: 9, letterSpacing: -0.3 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  authorText: { fontFamily: F.serifItalic, fontSize: 14.5, color: C.ink2 },
  authorInput: { flex: 1, fontFamily: F.serifItalic, fontSize: 14.5, color: C.ink2, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,.3)', paddingVertical: 2, marginRight: 10 },
  shareBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(0,0,0,.2)', alignItems: 'center', justifyContent: 'center' },
  shareGlyph: { fontSize: 12, color: C.ink },
  cardDivider: { height: 1, backgroundColor: C.cardHair, marginVertical: 14 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stars: { flexDirection: 'row', gap: 3 },
  star: { fontSize: 17, lineHeight: 20 },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,.18)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: C.ink },
  noteQuote: { borderLeftWidth: 2, borderLeftColor: C.rust, paddingLeft: 12, marginTop: 14 },
  noteText: { fontFamily: F.serifItalic, fontSize: 14, lineHeight: 21 },
  noteInput: { height: 74, borderWidth: 1, borderColor: 'rgba(0,0,0,.2)', borderRadius: 4, padding: 9, fontSize: 12, lineHeight: 18, color: '#222', backgroundColor: '#fff', textAlignVertical: 'top' },
  noteActions: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  saveBtn: { backgroundColor: C.ink, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 5, marginRight: 8 },
  saveBtnText: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: C.cream },
  cancelBtnText: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#6b6b67', paddingHorizontal: 6, paddingVertical: 7 },
  primaryBtn: { marginTop: 18, backgroundColor: C.ink, borderRadius: 6, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: C.cream, fontSize: 13, fontWeight: '500' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 15, gap: 14 },
  actionText: { fontFamily: F.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: '#5a5a55' },
  moveList: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,.1)', paddingTop: 12 },
  moveLabel: { fontFamily: F.mono, fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', color: C.muted2, marginBottom: 9 },
  moveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  moveName: { fontFamily: F.serif, fontSize: 14, color: C.ink },
  moveArrow: { fontFamily: F.mono, fontSize: 11, color: C.rust },

  // add modal
  addBody: { paddingHorizontal: 17, paddingTop: 2, paddingBottom: 20 },
  addTitle: { fontFamily: F.serif, fontSize: 26, color: C.ink, marginTop: 6, letterSpacing: -0.3 },
  fieldLabel: { fontFamily: F.mono, fontSize: 8, letterSpacing: 1.5, color: C.muted, textTransform: 'uppercase', marginBottom: 4 },
  titleInput: { borderBottomWidth: 1, borderBottomColor: 'rgba(22,22,22,.25)', fontFamily: F.serif, fontSize: 17, color: C.ink, paddingVertical: 3 },
  selectedRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'center', backgroundColor: '#EDE9DE', borderRadius: 4, padding: 10 },
  selectedThumb: { width: 44, height: 66, overflow: 'hidden', backgroundColor: '#e7e2d6' },
  selectedAuthor: { fontFamily: F.serifItalic, fontSize: 13.5, color: C.ink2 },
  selectedYear: { fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 2 },
  changeLink: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.5, color: C.rust, textTransform: 'uppercase' },
  candidateList: { marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(22,22,22,.1)', maxHeight: 260 },
  candidateRow: { flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(22,22,22,.08)' },
  candidateThumb: { width: 34, height: 51, overflow: 'hidden', backgroundColor: '#e7e2d6' },
  candidateTitle: { fontFamily: F.serif, fontSize: 14, color: C.ink },
  candidateCaption: { fontFamily: F.mono, fontSize: 8.5, color: C.muted, marginTop: 2 },
  searching: { fontFamily: F.mono, fontSize: 9, color: C.muted2, marginTop: 10, letterSpacing: 0.5 },
  manualAuthor: { borderBottomWidth: 1, borderBottomColor: 'rgba(22,22,22,.25)', fontFamily: F.serifItalic, fontSize: 14.5, color: C.ink2, paddingVertical: 2 },
  manualToggle: { fontFamily: F.mono, fontSize: 9, letterSpacing: 0.5, color: C.muted, textTransform: 'uppercase', marginTop: 12, textDecorationLine: 'underline' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },

  toast: { position: 'absolute', bottom: 96, alignSelf: 'center', backgroundColor: C.ink, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },
  toastText: { fontFamily: F.mono, fontSize: 10, letterSpacing: 0.5, color: C.cream },
})
