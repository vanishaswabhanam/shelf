import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'

const SHELF_IMAGES = [
  require('../assets/shelf1.png'),
  require('../assets/shelf2.png'),
  require('../assets/shelf3.png'),
  require('../assets/shelf4.png'),
]

const BOOKS_STORAGE_KEY = '@shelf_books'

const CATEGORIES = [
  { key: 'favorites', name: 'my favorites' },
  { key: 'nonfiction', name: 'recent reads' },
  { key: 'everything', name: 'everything' },
  { key: 'read', name: 'to be read' },
]

const bookW = 84
const bookH = 118
const gap = 14

function BookRow({
  books,
  categoryKey,
  onAdd,
  onBookPress,
  onReplace,
  onRemove,
}) {
  const handleLongPress = (book) => {
    Alert.alert('Book', undefined, [
      { text: 'Replace photo', onPress: () => onReplace(categoryKey, book.id) },
      { text: 'Remove', style: 'destructive', onPress: () => onRemove(categoryKey, book.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.bookRowContent}
    >
      {books.map((book) => (
        <Pressable
          key={book.id}
          style={[styles.bookSlot, { marginRight: gap }]}
          onPress={() => onBookPress(categoryKey, book)}
          onLongPress={() => handleLongPress(book)}
        >
          <Image
            source={{ uri: book.uri }}
            style={styles.bookCover}
            resizeMode="contain"
          />
        </Pressable>
      ))}
      <Pressable
        style={styles.addSlot}
        onPress={() => onAdd(categoryKey)}
      >
        <Text style={styles.addSlotText}>+</Text>
      </Pressable>
    </ScrollView>
  )
}

export default function ShelfLifePhone() {
  const [booksByCategory, setBooksByCategory] = useState(() =>
    CATEGORIES.reduce((acc, c) => ({ ...acc, [c.key]: [] }), {})
  )
  const [expandedBook, setExpandedBook] = useState(null)

  const loadBooks = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(BOOKS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setBooksByCategory((prev) => ({ ...prev, ...parsed }))
      }
    } catch (_) {}
  }, [])

  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  const saveBooks = useCallback((nextOrUpdater) => {
    setBooksByCategory((prev) => {
      const next =
        typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
      try {
        AsyncStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(next))
      } catch (_) {}
      return next
    })
  }, [])

  const ensureBooksDir = useCallback(async () => {
    const dir = FileSystem.documentDirectory + 'books/'
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
    return dir
  }, [])

  const addImageToCategory = useCallback(
    async (categoryKey, uri) => {
      const dir = await ensureBooksDir()
      const id = `book_${Date.now()}`
      const dest = dir + id + '.jpg'
      await FileSystem.copyAsync({ from: uri, to: dest })
      saveBooks((prev) => ({
        ...prev,
        [categoryKey]: [...(prev[categoryKey] || []), { id, uri: dest }],
      }))
    },
    [saveBooks, ensureBooksDir]
  )

  const pickFromLibraryAndAdd = useCallback(
    async (categoryKey) => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to photos to add book covers.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      })
      if (result.canceled || !result.assets?.[0]?.uri) return
      await addImageToCategory(categoryKey, result.assets[0].uri)
    },
    [addImageToCategory]
  )

  const pickFromFilesAndAdd = useCallback(
    async (categoryKey) => {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]?.uri) return
      await addImageToCategory(categoryKey, result.assets[0].uri)
    },
    [addImageToCategory]
  )

  const showSourceThenAdd = useCallback(
    (categoryKey) => {
      Alert.alert(
        'Add book from',
        undefined,
        [
          { text: 'Photo Library', onPress: () => pickFromLibraryAndAdd(categoryKey) },
          { text: 'Files / Pictures', onPress: () => pickFromFilesAndAdd(categoryKey) },
          { text: 'Cancel', style: 'cancel' },
        ]
      )
    },
    [pickFromLibraryAndAdd, pickFromFilesAndAdd]
  )

  const replaceBook = useCallback(
    async (categoryKey, bookId) => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') return
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      })
      if (result.canceled || !result.assets?.[0]?.uri) return
      const uri = result.assets[0].uri
      const dir = await ensureBooksDir()
      const newId = `book_${Date.now()}`
      const dest = dir + newId + '.jpg'
      await FileSystem.copyAsync({ from: uri, to: dest })
      saveBooks((prev) => ({
        ...prev,
        [categoryKey]: (prev[categoryKey] || []).map((b) =>
          b.id === bookId ? { id: newId, uri: dest } : b
        ),
      }))
    },
    [saveBooks, ensureBooksDir]
  )

  const removeBook = useCallback(
    (categoryKey, bookId) => {
      saveBooks((prev) => ({
        ...prev,
        [categoryKey]: (prev[categoryKey] || []).filter((b) => b.id !== bookId),
      }))
    },
    [saveBooks]
  )

  const addBooksToCategory = useCallback(() => {
    Alert.alert(
      'Add to category',
      'Choose a category, then pick a photo for the book cover.',
      CATEGORIES.map((cat) => ({
        text: cat.name,
        onPress: () => showSourceThenAdd(cat.key),
      })).concat([{ text: 'Cancel', style: 'cancel' }])
    )
  }, [showSourceThenAdd])

  return (
    <View style={styles.stage}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerSmall}>My Favourite</Text>
          <Text style={styles.headerBig}>BOOKS</Text>
        </View>

        <View style={styles.categories}>
          {CATEGORIES.map((cat, index) => {
            const books = booksByCategory[cat.key] || []
            return (
              <View key={cat.key} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionName}>{cat.name}</Text>
                  <View style={styles.sectionMetaRow}>
                    <Text style={styles.sectionMetaText}>
                      {books.length} book{books.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.arrows}>{'‹'} {'›'}</Text>
                  </View>
                </View>

                <View style={styles.bookRowWrapper}>
                  <BookRow
                    books={books}
                    categoryKey={cat.key}
                    onAdd={showSourceThenAdd}
                    onBookPress={(categoryKey, book) => setExpandedBook({ categoryKey, ...book })}
                    onReplace={replaceBook}
                    onRemove={removeBook}
                  />
                  <Image
                    source={SHELF_IMAGES[index]}
                    style={styles.shelfImage}
                    resizeMode="cover"
                    pointerEvents="none"
                  />
                </View>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomOverlay} pointerEvents="box-none">
        <LinearGradient
          colors={[
            'transparent',
            'rgba(245, 245, 245, 0.06)',
            'rgba(245, 245, 245, 0.14)',
            'rgba(245, 245, 245, 0.24)',
            'rgba(245, 245, 245, 0.36)',
            'rgba(245, 245, 245, 0.5)',
            'rgba(245, 245, 245, 0.64)',
            'rgba(245, 245, 245, 0.78)',
            'rgba(245, 245, 245, 0.9)',
            '#F5F5F5',
          ]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <Pressable style={styles.addBooksWrap} onPress={addBooksToCategory}>
          <Text style={styles.addBooksText}>Add Books</Text>
        </Pressable>
      </View>

      <Modal
        visible={!!expandedBook}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedBook(null)}
      >
        <Pressable
          style={styles.expandedBackdrop}
          onPress={() => setExpandedBook(null)}
        >
          <Pressable style={styles.expandedCard} onPress={(e) => e.stopPropagation()}>
            {expandedBook && (
              <>
                <Image
                  source={{ uri: expandedBook.uri }}
                  style={styles.expandedImage}
                  resizeMode="contain"
                />
                <Pressable
                  style={styles.expandedDeleteBtn}
                  onPress={() => {
                    removeBook(expandedBook.categoryKey, expandedBook.id)
                    setExpandedBook(null)
                  }}
                >
                  <Text style={styles.expandedDeleteText}>Delete</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  screen: {
    flex: 1,
    paddingTop: 92,
    paddingLeft: 43,
    paddingRight: 22,
  },
  scrollContent: {
    paddingBottom: 260,
  },

  header: {
    alignItems: 'center',
    marginBottom: 42,
  },
  headerSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    fontFamily: 'Georgia',
    marginBottom: 6,
  },
  headerBig: {
    fontSize: 44,
    fontWeight: '800',
    color: '#111',
    fontFamily: 'Georgia',
    lineHeight: 48,
    letterSpacing: -1,
  },

  categories: {
    flexDirection: 'column',
  },
  section: {
    marginBottom: 62,
    overflow: 'visible',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'System',
  },
  sectionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 18,
  },
  sectionMetaText: {
    fontSize: 12,
    color: '#9b9b9b',
    fontWeight: '500',
    marginRight: 8,
  },
  arrows: {
    color: '#a7a7a7',
    fontSize: 12,
    fontWeight: '700',
  },

  bookRowWrapper: {
    position: 'relative',
    minHeight: 118,
    overflow: 'visible',
  },
  bookRowContent: {
    alignItems: 'flex-start',
    paddingBottom: 2,
  },
  bookSlot: {
    width: bookW,
    height: bookH,
  },
  bookCover: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    backgroundColor: '#e8e8e8',
  },
  addSlot: {
    width: bookW,
    height: bookH,
    backgroundColor: '#D9D9D9',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSlotText: {
    fontSize: 28,
    color: '#999',
    fontWeight: '300',
  },
  shelfImage: {
    position: 'absolute',
    left: -65,
    right: -40,
    bottom: -120,
    height: 270,
    width: undefined,
    opacity: 0.62,
  },
  expandedBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedCard: {
    width: '88%',
    maxWidth: 320,
    alignItems: 'center',
  },
  expandedImage: {
    width: '100%',
    aspectRatio: 0.7,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  expandedDeleteBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  expandedDeleteText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },

  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 260,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 40,
  },
  addBooksWrap: {
    backgroundColor: '#000',
    borderRadius: 999,
    paddingHorizontal: 40,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  addBooksText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
})
