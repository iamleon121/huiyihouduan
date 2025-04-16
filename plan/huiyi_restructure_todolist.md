
# 会议系统前端重构计划 (面向对象拆分)

目标
将单一的huiyi.html文件重构为模块化、面向对象的结构，提高代码可维护性、可测试性和可扩展性。

文件结构规划
/meeting-system/
├── index.html                  # 主HTML文件（简化版）
├── css/
│   ├── main.css                # 基础样式
│   ├── variables.css           # CSS变量
│   ├── layout.css              # 布局样式
│   ├── components.css          # 组件样式
│   ├── modal.css               # 模态框样式
│   └── responsive.css          # 响应式设计
├── js/
│   ├── app.js                  # 应用入口
│   ├── config.js               # 配置信息
│   ├── utils/
│   │   ├── dom-utils.js        # DOM操作工具
│   │   ├── api-client.js       # API请求封装
│   │   ├── form-utils.js       # 表单处理工具
│   │   └── json-utils.js       # JSON处理工具
│   ├── models/
│   │   ├── meeting.js          # 会议数据模型
│   │   └── agenda-item.js      # 议程项数据模型
│   ├── views/
│   │   ├── sidebar-view.js     # 侧边栏视图
│   │   ├── meeting-list-view.js # 会议列表视图
│   │   ├── meeting-form-view.js # 会议表单视图
│   │   └── meeting-detail-view.js # 会议详情视图
│   ├── controllers/
│   │   ├── router.js           # 路由控制器
│   │   ├── meeting-controller.js # 会议控制器
│   │   └── modal-controller.js # 模态框控制器
│   └── components/
│       ├── modal.js            # 模态框组件
│       ├── pagination.js       # 分页组件
│       ├── status-badge.js     # 状态标签组件
│       └── action-buttons.js   # 操作按钮组件
└── templates/                  # HTML模板
    ├── meeting-list.html       # 会议列表模板
    ├── meeting-form.html       # 会议表单模板
    └── meeting-detail.html     # 会议详情模板
重构步骤
1. 基础结构分离
[ ] 创建项目文件夹结构：按照上述规划创建目录
[ ] 分离HTML结构：
[ ] 创建简化版index.html，只包含基本结构和必要的脚本/样式引用
[ ] 将模态框模板移至templates/目录
[ ] 分离CSS：
[ ] 将CSS变量提取到variables.css
[ ] 将布局样式移至layout.css
[ ] 将组件样式移至components.css
[ ] 将模态框样式移至modal.css
[ ] 将响应式设计规则移至responsive.css
2. JavaScript模块化
[ ] 创建工具类：

[ ] dom-utils.js：封装DOM操作（选择器、事件绑定等）
[ ] api-client.js：封装API请求（fetch包装器）
[ ] form-utils.js：表单处理（验证、序列化等）
[ ] json-utils.js：安全的JSON解析和序列化
[ ] 创建数据模型：

[ ] meeting.js：会议模型类，包含属性和方法
[ ] agenda-item.js：议程项模型类
[ ] 创建视图类：

[ ] sidebar-view.js：侧边栏视图管理
[ ] meeting-list-view.js：会议列表渲染和交互
[ ] meeting-form-view.js：会议表单处理
[ ] meeting-detail-view.js：会议详情展示
[ ] 创建控制器：

[ ] router.js：处理路由和页面切换
[ ] meeting-controller.js：会议数据处理和业务逻辑
[ ] modal-controller.js：模态框控制
[ ] 创建组件：

[ ] modal.js：通用模态框组件
[ ] pagination.js：分页组件
[ ] status-badge.js：状态标签组件
[ ] action-buttons.js：操作按钮组件
3. 面向对象重构
[ ] 实现基类：

[ ] BaseComponent：所有组件的基类，处理生命周期和事件
[ ] BaseModel：数据模型基类，处理数据验证和转换
[ ] BaseView：视图基类，处理渲染和DOM交互
[ ] 会议模型类：

class Meeting extends BaseModel {
  constructor(data = {}) {
    super();
    this.id = data.id || '';
    this.title = data.title || '';
    this.intro = data.intro || '';
    this.time = data.time || null;
    this.status = data.status || '未开始';
    this.agendaItems = (data.agenda_items || []).map(item => new AgendaItem(item));
  }
  
  validate() {
    // 验证逻辑
  }
  
  toJSON() {
    // 转换为API格式
  }
}
[ ] 议程项模型类：

class AgendaItem extends BaseModel {
  constructor(data = {}) {
    super();
    this.id = data.id;
    this.title = data.title || '';
    this.reporter = data.reporter || '';
    this.durationMinutes = data.duration_minutes || null;
    this.files = data.files || [];
    this.pages = data.pages || [];
  }
  
  validate() {
    // 验证逻辑
  }
}
[ ] 会议服务类：

class MeetingService {
  static async getAll() {
    // 获取所有会议
  }
  
  static async getById(id) {
    // 获取单个会议
  }
  
  static async create(meeting) {
    // 创建会议
  }
  
  static async update(meeting) {
    // 更新会议
  }
  
  static async delete(id) {
    // 删除会议
  }
  
  static async updateStatus(id, status) {
    // 更新会议状态
  }
}
4. 事件处理和状态管理
[ ] 实现事件总线：

class EventBus {
  constructor() {
    this.events = {};
  }
  
  on(event, callback) {
    // 订阅事件
  }
  
  off(event, callback) {
    // 取消订阅
  }
  
  emit(event, data) {
    // 触发事件
  }
}
[ ] 实现简单状态管理：

class Store {
  constructor(initialState = {}) {
    this.state = initialState;
    this.eventBus = new EventBus();
  }
  
  setState(newState) {
    // 更新状态并触发事件
  }
  
  getState() {
    // 获取状态
  }
  
  subscribe(callback) {
    // 订阅状态变化
  }
}
5. 集成和测试
[ ] 创建应用入口：

class App {
  constructor() {
    this.store = new Store({
      meetings: [],
      currentPage: 'meetings',
      loading: false,
      error: null
    });
    
    this.router = new Router();
    this.meetingController = new MeetingController(this.store);
    
    // 初始化视图
    this.sidebarView = new SidebarView(document.querySelector('.sidebar'));
    this.contentView = null; // 将根据路由动态创建
    
    // 设置路由
    this.setupRoutes();
  }
  
  setupRoutes() {
    // 配置路由
  }
  
  start() {
    // 启动应用
    this.router.init();
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.start();
});
[ ] 编写单元测试：为关键类和方法编写测试

优先级和实施顺序
第一阶段：基础结构分离

分离HTML、CSS和JavaScript
创建基本文件结构
第二阶段：核心功能模块化

实现API客户端
实现数据模型
实现基本视图
第三阶段：面向对象重构

实现基类
重构为完整的类结构
第四阶段：高级功能

实现事件总线
实现状态管理
完善路由系统
第五阶段：优化和测试

编写单元测试
性能优化
浏览器兼容性测试
注意事项
渐进式重构：不要一次性重写所有代码，而是逐步替换
保持功能一致：确保重构后的功能与原始代码相同
添加注释：为类和方法添加清晰的文档注释
遵循设计模式：适当使用MVC、观察者、工厂等设计模式
考虑扩展性：设计时考虑未来可能的功能扩展