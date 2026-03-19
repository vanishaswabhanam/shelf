import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

const CATEGORIES = [
  { key: 'favorites', name: 'my favorites', meta: '16 books', highlight: true },
  { key: 'read', name: 'to be read', meta: '16 books', highlight: false },
  { key: 'nonfiction', name: 'nonfiction', meta: '16 books', highlight: false },
  { key: 'everything', name: 'everything', meta: '16 books', highlight: false },
]

function BookRow({ count, visibleColumns = 3.5 }) {
  const bookW = 58
  const bookH = 84
  const gap = 10
  const rowW = bookW * visibleColumns + gap * 3

  return (
    <View style={[styles.bookRowClip, { width: rowW, height: bookH }]}>
      <View style={styles.bookRow}>
        {Array.from({ length: count }).map((_, i) => (
          <View
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={[
              styles.bookPlaceholder,
              { width: bookW, height: bookH, marginRight: i === count - 1 ? 0 : gap },
            ]}
          />
        ))}
      </View>
    </View>
  )
}

function FavoritesScrim({ children }) {
  // Fake a top-to-bottom reflection without extra dependencies:
  // top is lighter, bottom slightly darker.
  return (
    <View style={styles.scrim}>
      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />
      <View style={styles.scrimContent}>{children}</View>
    </View>
  )
}

export default function ShelfLifePhone() {
  return (
    <View style={styles.stage}>
      <View style={styles.card}>
        <Text style={styles.title}>Shelf Life</Text>
        <Text style={styles.subtitle}>my library to you</Text>

        <View style={styles.categories}>
          {CATEGORIES.map((cat) => (
            <View key={cat.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionName}>{cat.name}</Text>
                <Text style={styles.sectionMeta}>
                  {cat.meta}
                  <Text style={styles.arrows}>&nbsp;&lt; &gt;</Text>
                </Text>
              </View>

              {cat.highlight ? (
                <FavoritesScrim>
                  <BookRow count={16} />
                </FavoritesScrim>
              ) : (
                <BookRow count={16} />
              )}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#EBEBEB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  card: {
    width: 252,
    height: 505,
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    paddingTop: 38,
    paddingLeft: 28,
    paddingRight: 22,
    paddingBottom: 46,
  },

  title: {
    fontSize: 34,
    fontStyle: 'italic',
    fontWeight: '500',
    color: '#111',
    lineHeight: 38,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#333',
  },

  categories: {
    marginTop: 20,
    flexDirection: 'column',
    gap: 20,
  },
  section: {},

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#222',
  },
  sectionMeta: {
    fontSize: 12,
    color: '#666',
  },
  arrows: {
    color: '#999',
    fontSize: 11,
  },

  bookRowClip: {
    overflow: 'hidden',
  },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bookPlaceholder: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 10,
  },

  scrim: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  scrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '56%',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '56%',
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  scrimContent: {
    position: 'relative',
  },
})

