import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import ShelfLifePhone from './components/ShelfLifePhone'

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ShelfLifePhone />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
})
