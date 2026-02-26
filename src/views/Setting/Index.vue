<template>
  <div id="setting">
    <div class="setting-box setting-themecolor">
      <div class="setting-box__title">主题色配置</div>
      <ThemeColorEditor
        ref="themeColorEditorComp"
        :themes="dfThemes"
        @onColorChanged="onColorChanged"
      />
      <div class="setting-box__control">
        <el-button type="danger" round @click="resetThemeColor">重置</el-button>
        <el-button type="primary" round @click="saveThemeColor">保存</el-button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, CSSProperties, defineComponent, reactive, ref } from 'vue'

import { getThemeInstance } from '@/theme/theme.class'

import ThemeColorEditor, {
  ThemeColorVar
} from './components/ThemeColorEditor.vue'
import { ElNotification } from 'element-plus'
import { useIsDev } from '@/hooks/utils'

import { AwDailog } from '@/components/AwDailog'

interface ConfigForm {
  formRules: any
  save: () => void
}

function themeColorModule() {
  const themeColorEditorComp = ref<InstanceType<typeof ThemeColorEditor>>()
  const dfThemes = getThemeInstance()!.current

  const onColorChanged = (param: ThemeColorVar[]) => {
    getThemeInstance()?.colorVarInit(param)
  }
  const saveThemeColor = () => {
    const theme = themeColorEditorComp.value!.getCurrnetTheme()
    getThemeInstance()?.saveLocalColor(theme)
    ElNotification({
      title: '主题配置',
      message: '主题保存成功',
      type: 'success'
    })
  }
  const resetThemeColor = async () => {
    try {
      await AwDailog({
        title: '确定重置主题吗？',
        content: '注意，确认以后会传递删除当前自定义配色，并且恢复默认主题！'
      })
      getThemeInstance()?.clearLocalColor()
      themeColorEditorComp.value!.reset()
    } catch {
      //
    }
  }

  return {
    themeColorEditorComp,
    onColorChanged,
    saveThemeColor,
    resetThemeColor,
    dfThemes
  }
}


export default defineComponent({
  name: 'Setting',
  components: {
    ThemeColorEditor
  },
  setup() {
    const isDev = useIsDev().get()
    const hideStyle = computed(
      () =>
        ({
          // opacity: isDev ? 0 : 1
        } as CSSProperties)
    )
    return {
      hideStyle,
      ...themeColorModule()
    }
  }
})
</script>
<style lang="less" scoped>
#setting {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  .setting-box {
    width: 100%;
    background: var(--box-bg-color);
    padding: 30px;
    box-sizing: border-box;
    border-top-left-radius: var(--df-radius);
    border-bottom-left-radius: var(--df-radius);
    margin-bottom: 30px;

    &__title {
      font-weight: 600;
      font-size: 20px;
      padding-bottom: 20px;
    }

    &__control {
      margin-top: 20px;
    }
  }

  // .setting-themecolor {
  // height: 400px;
  // }
  .setting-config {
    ::v-deep(.el-form) {
      width: 400px;
    }
  }
}
</style>