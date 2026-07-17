import React, { useCallback } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium_Italic,
} from '@expo-google-fonts/newsreader'
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono'
import ShelfLifePhone from './components/ShelfLifePhone'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function App() {
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium_Italic,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  })

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <View style={styles.container} onLayout={onLayout}>
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
