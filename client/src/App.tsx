import { useEffect, useRef, useState, useContext } from 'react'
import { Helmet } from 'react-helmet'
import { getCookie } from 'typescript-cookie'
import { DefaultParams, PathPattern, Route, Switch } from 'wouter'
import Footer from './components/footer'
import { Header } from './components/header'
import { Padding } from './components/padding'
import useTableOfContents from './hooks/useTableOfContents.tsx'
import { client } from './main'
import { CallbackPage } from './page/callback'
import { FeedPage, TOCHeader } from './page/feed'
import { FeedsPage } from './page/feeds'
import { FriendsPage } from './page/friends'
import { HashtagPage } from './page/hashtag.tsx'
import { HashtagsPage } from './page/hashtags.tsx'
import { Settings } from "./page/settings.tsx"
import { TimelinePage } from './page/timeline'
import { WritingPage } from './page/writing'
import { ClientConfigContext, ConfigWrapper, defaultClientConfig } from './state/config.tsx'
import { Profile, ProfileContext } from './state/profile'
import { headersWithAuth } from './utils/auth'
import { tryInt } from './utils/int'
import { SearchPage } from './page/search.tsx'
import { Tips, TipsPage } from './components/tips.tsx'
import { useTranslation } from 'react-i18next'
import { MomentsPage } from './page/moments'
import { ErrorPage } from './page/error.tsx'

function App() {
  const ref = useRef(false)
  const { t } = useTranslation()
  const [profile, setProfile] = useState<Profile | undefined>()
  const [config, setConfig] = useState<ConfigWrapper>(new ConfigWrapper({}, new Map()))
  
  // 音频状态管理
  const [audioInstance, setAudioInstance] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // --- 自动缩放逻辑 ---
    const HIGH_RES_THRESHOLD = 2560;
    const applyScaling = () => {
      // 建议使用 innerWidth 代替 screen.width 以获得更准确的视口判定
      if (window.innerWidth >= HIGH_RES_THRESHOLD) {
        document.documentElement.style.fontSize = '125%';
      } else {
        document.documentElement.style.fontSize = '100%';
      }
    };
    applyScaling();
    window.addEventListener('resize', applyScaling);
    // ------------------

    // --- 背景音乐初始化 (只在组件挂载时执行一次) ---
    if (!ref.current) {
        // ⚠️ 请务必确保这些文件存在于您的 public/music/ 文件夹中
        // ⚠️ 强烈建议将文件名重命名为简单的英文，避免中文/特殊符号导致 404
        const musicFiles = [
          '1.mp3',
          '2.mp3', 
          '3.mp3'
        ];
        
        // 如果您坚持使用中文文件名，请确保文件名与这里完全一致（包括扩展名）
        // const musicFiles = ['太聪明-陈绮贞.mp3', ...];

        if (musicFiles.length > 0) {
            const randomIndex = Math.floor(Math.random() * musicFiles.length);
            // 使用 encodeURIComponent 处理文件名，减少特殊字符引起的路径错误
            const filePath = `/music/${musicFiles[randomIndex]}`;
            
            console.log("正在尝试加载音频:", filePath); // 调试日志

            const newAudio = new Audio(filePath);
            newAudio.loop = true;
            
            // 监听音频播放结束或暂停，同步状态
            newAudio.onpause = () => setIsPlaying(false);
            newAudio.onplay = () => setIsPlaying(true);
            
            setAudioInstance(newAudio);
        }
    }
    // ------------------

    if (ref.current) return

    // --- 用户登录与配置获取逻辑 ---
    if (getCookie('token')?.length ?? 0 > 0) {
      client.user.profile.get({
        headers: headersWithAuth()
      }).then(({ data }) => {
        if (data && typeof data !== 'string') {
          setProfile({
            id: data.id,
            avatar: data.avatar || '',
            permission: data.permission,
            name: data.username
          })
        }
      })
    }
    
    const config = sessionStorage.getItem('config')
    if (config) {
      const configObj = JSON.parse(config)
      const configWrapper = new ConfigWrapper(configObj, defaultClientConfig)
      setConfig(configWrapper)
    } else {
      client.config({ type: "client" }).get().then(({ data }) => {
        if (data && typeof data !== 'string') {
          sessionStorage.setItem('config', JSON.stringify(data))
          const config = new ConfigWrapper(data, defaultClientConfig)
          setConfig(config)
        }
      })
    }
    
    ref.current = true
    
    // 清理函数
    return () => {
        window.removeEventListener('resize', applyScaling);
        if (audioInstance) {
            audioInstance.pause();
            setAudioInstance(null);
        }
    }
  }, [])

  // --- 播放/暂停 切换逻辑 ---
  const toggleAudio = () => {
    if (!audioInstance) {
        console.warn("音频对象未初始化，请检查 useEffect 中的初始化逻辑");
        return;
    }

    if (isPlaying) {
      // 如果正在播放，则暂停
      audioInstance.pause();
      // 状态会通过 onpause 事件回调自动更新，这里也可以手动更新以防万一
      setIsPlaying(false);
    } else {
      // 如果暂停，则尝试播放
      const playPromise = audioInstance.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // 播放成功
            console.log("音频开始播放");
            setIsPlaying(true);
          })
          .catch(error => {
            // 播放失败 (通常是 404 或 浏览器策略)
            console.error("播放失败:", error);
            setIsPlaying(false);
            
            // 友好的错误提示
            if (error.name === 'NotAllowedError') {
                alert("浏览器阻止了自动播放，请再点击一次尝试。");
            } else if (error.message.includes('404') || error.name === 'NotSupportedError') {
                alert(`无法找到音频文件！\n请按 F12 打开控制台查看具体错误。\n请检查 public/music/ 文件夹下是否有对应的 mp3 文件。`);
            } else {
                alert("播放出错: " + error.message);
            }
          });
      }
    }
  };

  const favicon = `${process.env.API_URL}/favicon`;

  return (
    <>
      <ClientConfigContext.Provider value={config}>
        <ProfileContext.Provider value={profile}>
          <Helmet>
            {favicon &&
              <link rel="icon" href={favicon} />}
          </Helmet>
          <Switch>
            <RouteMe path="/">
              <FeedsPage />
            </RouteMe>

            <RouteMe path="/timeline">
              <TimelinePage />
            </RouteMe>
            
            <RouteMe path="/moments">
              <MomentsPage />
            </RouteMe>

            <RouteMe path="/friends">
              <FriendsPage />
            </RouteMe>

            <RouteMe path="/hashtags">
              <HashtagsPage />
            </RouteMe>

            <RouteMe path="/hashtag/:name">
              {params => {
                return (<HashtagPage name={params.name || ""} />)
              }}
            </RouteMe>

            <RouteMe path="/search/:keyword">
              {params => {
                return (<SearchPage keyword={params.keyword || ""} />)
              }}
            </RouteMe>

            <RouteMe path="/settings" paddingClassName='mx-4' requirePermission>
              <Settings />
            </RouteMe>

            <RouteMe path="/writing" paddingClassName='mx-4' requirePermission>
              <WritingPage />
            </RouteMe>

            <RouteMe path="/writing/:id" paddingClassName='mx-4' requirePermission>
              {({ id }) => {
                const id_num = tryInt(0, id)
                return (
                  <WritingPage id={id_num} />
                )
              }}
            </RouteMe>

            <RouteMe path="/callback" >
              <CallbackPage />
            </RouteMe>

            <RouteWithIndex path="/feed/:id">
              {(params, TOC, clean) => {
                return (<FeedPage id={params.id || ""} TOC={TOC} clean={clean} />)
              }}
            </RouteWithIndex>

            <RouteWithIndex path="/:alias">
              {(params, TOC, clean) => {
                return (
                  <FeedPage id={params.alias || ""} TOC={TOC} clean={clean} />
                )
              }}
            </RouteWithIndex>

            <RouteMe path="/user/github">
              {_ => (
                <TipsPage>
                  <Tips value={t('error.api_url')} type='error' />
                </TipsPage>
              )}
            </RouteMe>

            <RouteMe path="/*/user/github">
              {_ => (
                <TipsPage>
                  <Tips value={t('error.api_url_slash')} type='error' />
                </TipsPage>
              )}
            </RouteMe>

            <RouteMe path="/user/github/callback">
              {_ => (
                <TipsPage>
                  <Tips value={t('error.github_callback')} type='error' />
                </TipsPage>
              )}
            </RouteMe>

            <RouteMe>
              <ErrorPage error={t('error.not_found')} />
            </RouteMe>
          </Switch>
            
          {/* --- 音乐控制按钮 --- */}
          <div 
            className="play-music-button" 
            onClick={toggleAudio}
            style={{ 
                position: 'fixed', 
                bottom: '20px', 
                right: '20px', 
                zIndex: 9999,
                padding: '10px 15px',
                background: isPlaying ? 'rgba(76, 175, 80, 0.9)' : 'rgba(0, 0, 0, 0.6)', 
                color: 'white',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                transition: 'all 0.3s ease',
                userSelect: 'none'
            }}
          >
            {isPlaying ? "🎵 音乐正在播放 (点击暂停)" : "▶️ 点击播放背景音乐"}
          </div>

        </ProfileContext.Provider>
      </ClientConfigContext.Provider>
    </>
  )
}

// 辅助组件保持不变
function RouteMe({ path, children, headerComponent, paddingClassName, requirePermission }:
  { path?: PathPattern, children: React.ReactNode | ((params: DefaultParams) => React.ReactNode), headerComponent?: React.ReactNode, paddingClassName?: string, requirePermission?: boolean }) {
  if (requirePermission) {
    const profile = useContext(ProfileContext);
    const { t } = useTranslation();
    if (!profile?.permission)
      children = <ErrorPage error={t('error.permission_denied')} />;
  }
  return (
    <Route path={path} >
      {params => {
        return (<>
          <Header>
            {headerComponent}
          </Header>
          <Padding className={paddingClassName}>
            {typeof children === 'function' ? children(params) : children}
          </Padding>
          <Footer />
        </>)

      }}
    </Route>
  )
}

function RouteWithIndex({ path, children }:
  { path: PathPattern, children: (params: DefaultParams, TOC: () => JSX.Element, clean: (id: string) => void) => React.ReactNode }) {
  const { TOC, cleanup } = useTableOfContents(".toc-content");
  return (<RouteMe path={path} headerComponent={TOCHeader({ TOC: TOC })} paddingClassName='mx-4'>
    {params => {
      return children(params, TOC, cleanup)
    }}
  </RouteMe>)
}

export default App
